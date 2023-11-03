/* eslint-disable no-bitwise */
import Gfx from './gfx.js';
import VMath from './math.js';
import SkinnedModel from './skinnedModel.js';
import Transform from './transform.js';
import MemoryLayout from './memoryLayout.js';

function readColor(landmark) {
  let color = [255, 255, 255];
  if (landmark.color !== undefined) {
    color = VMath.hexColorToIntVector(landmark.color);
  }
  const alpha = 255;
  return color.concat(alpha);
}

function getModelStats(json) {
  const stats = {
    vertexCount: json.dataArrays.position.length / 3,
    meshCount: json.meshes.length,
    missingUVs: json.missingUVs,
    missingNormals: json.missingNormals,
  };
  if (json.skin) {
    stats.jointCount = json.skin.joints.length;
    stats.maxJointsPerVertex = json.skin.maxJointCount;
  }
  return stats;
}

function chunkedAndSorted(array, chunkSize) {
  const out = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    const t = array.slice(i, i + chunkSize);
    t.sort();
    out.push(t);
  }
  return out;
}

function arrayCmp(a, b) {
  let i = 0;
  while (i < a.length && i < b.length) {
    if (a[i] < b[i]) {
      return -1;
    }
    if (a[i] > b[i]) {
      return 1;
    }
    i += 1;
  }
  if (a.length < b.length) {
    return -1;
  }
  if (a.length > b.length) {
    return 1;
  }
  return 0;
}

// Vertex coloring. A planar graph is 4-colorable, but a mesh is not planar in general.
// A tetrahedron needs 4 colors, but most surfaces may be 3-colorable.
// We can use this function to paint vertices with
// barycentric coordinates.
function colorVertices(vertexCount, meshes, colors) {
  const labels = [...Array(vertexCount)].map(() => 0);
  let coloringFailed = 0;
  meshes.forEach((mesh) => {
    const triangles = chunkedAndSorted(mesh.indices, 3);
    triangles.sort(arrayCmp);
    triangles.forEach((triangle) => {
      let available = [1, 2, 3];
      triangle.forEach((vertexIndex) => {
        available = available.filter(x => x !== labels[vertexIndex]);
      });
      triangle.forEach((vertexIndex) => {
        if (labels[vertexIndex] === 0) {
          if (available.length === 0) {
            coloringFailed += 1;
          } else {
            labels[vertexIndex] = available.shift();
          }
        }
      });
    });
  });
  if (coloringFailed > 0) {
    console.log(`Not 3-colorable. ${coloringFailed} vertices couldn't be colored.`);
  } else {
    console.log('Model is 3-colorable.');
  }
  const flatColorData = [];
  labels.forEach((label) => {
    const color = label > 0 ? colors[label - 1] : 0;
    flatColorData.push(0xff & (color >> 24));
    flatColorData.push(0xff & (color >> 16));
    flatColorData.push(0xff & (color >> 8));
    flatColorData.push(0xff & color);
  });
  return flatColorData;
}

class Model {
  // format:
  // { name: // model name
  //   materials: {
  //     "name": {
  //       albedoMap: "image.png",
  //     }
  //   },
  //   dataArrays: {
  //     position: [],
  //     normal: [],
  //     uv: [],
  //     objectId: [],
  //     boneWeights: [],
  //     boneIndices: []
  //   },
  //   meshes: // array of submeshes
  //      [ {material: // material reference
  //         indices: // faces of the submesh
  //      }]
  // }
  constructor(gl, json, imageUrls, config) {
    this.name = json.name;
    this.meterUnits = json.meterUnits || 1;
    let armatureTransform = new Transform({});
    this.transform = new Transform({});
    if (json.armature) {
      armatureTransform = Transform.fromRowMajorArray(json.armature.matrix, json.armature.rotationOrder || 'xyz');
      const s = json.meterUnits || 1;
      this.transform.position = armatureTransform.position.map(a => s * a);
    }
    // override order because for the UI we want to
    // apply Y rotation (1) before X (0)
    this.transform.rotationOrder = 'xyz';
    // vertices
    this.vertexBuffer = gl.createBuffer();
    this.stats = getModelStats(json);
    if (json.skin) {
      this.skinnedModel = new SkinnedModel(json.skin, json.skeleton,
        json.anims, armatureTransform, config.reRig);
    } else {
      this.skinnedModel = null;
    }
    // for rendering purposes only, we don't need to keep these arrays,
    // but we will need them if we want to do things on the CPU side.
    this.dataArrays = json.dataArrays;
    // color with barycentric coordinates (1, 0, 0), (0, 1, 0), (0, 0, 1)
    this.dataArrays.color = colorVertices(this.stats.vertexCount, json.meshes, [
      0xff000000,
      0x00ff0000,
      0x0000ff00,
    ]);
    this.memoryLayout = json.skin ? MemoryLayout.skinnedVertexLayout()
      : MemoryLayout.defaultVertexLayout();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    const arrayBuffer = this.memoryLayout.createInterleavedArrayBufferFromDataArrays(
      this.dataArrays,
    );
    gl.bufferData(gl.ARRAY_BUFFER, arrayBuffer, gl.STATIC_DRAW);
    // submeshes
    const meshes = [];
    let triangles = []; // again, remember for CPU computations
    json.meshes.forEach((m) => {
      const id = m.material || '';
      const mat = json.materials[id] || {};
      const albedoMapName = mat.albedoMap || 'missing';
      const albedoMapUrl = imageUrls[albedoMapName]
        // if the .dds texture is missing, try to find equivalent .png
        || imageUrls[`${Gfx.getFileNameWithoutExtension(albedoMapName)}.png`]
        // or use the 'missing' texture otherwise
        || imageUrls.missing;
      const mesh = {
        id,
        indexBuffer: gl.createBuffer(),
        numElements: m.indices.length,
        numVertices: (new Set(m.indices)).size,
        albedoUrl: albedoMapUrl,
        albedoMap: albedoMapUrl !== undefined ? Gfx.loadTexture(gl, albedoMapUrl) : false,
      };
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,
        new Uint32Array(m.indices), // 32-bit for more than 64K verts
        gl.STATIC_DRAW);
      meshes.push(mesh);
      triangles = triangles.concat(m.indices);
    });
    this.meshes = meshes;
    this.triangles = triangles;
    this.labels = json.labels || {};
  }
  destroy(gl) {
    Gfx.destroyBuffers(gl, this);
  }
  static createAsync(gl, name, url, config, imageUrls, materialUrls, onProgress, onDone, onError) {
    Gfx.modelFileToJson(name, url, materialUrls)
      .then((json) => {
        if (config.recomputeNormals || json.missingNormals) {
          if (window.Worker) {
            const worker = new Worker('./js/modelWorker.js');
            const load = {
              model: json,
              fn: 'recomputeNormals',
            };
            worker.onmessage = (e) => {
              onProgress(e.data.progress);
              if (e.data.done && e.data.dataArrays) {
                const jsonRef = json;
                jsonRef.dataArrays = e.data.dataArrays;
                onDone(new Model(gl, jsonRef, imageUrls, config));
              }
            };
            worker.postMessage(load);
          } else {
            throw new Error("Can't create Worker to compute normals");
          }
        } else {
          onDone(new Model(gl, json, imageUrls, config));
        }
      })
      .catch(onError);
  }
  bakeLabels(gl, labelScale, onProgress, onDone, onError) {
    const self = this;
    const landmarks = self.labels || {};
    const landmarkList = Object.keys(landmarks);
    const positions = {};
    const colors = {};
    landmarkList.forEach((key) => {
      const p = landmarks[key];
      const pos = VMath.readCoordinates(p).slice(0, 3);
      const posScaled = VMath.mulScalar(pos, labelScale);
      positions[key] = posScaled;
      colors[key] = readColor(p);
      if (p.disabled) {
        // half-bright dots for disabled landmarks
        colors[key][0] /= 2;
        colors[key][1] /= 2;
        colors[key][2] /= 2;
      }
    });
    if (this.skinnedModel) {
      if (window.Worker) {
        const worker = new Worker('./js/modelDistanceWorker.js');
        const load = {
          positions,
          dataArrays: this.dataArrays,
          transformMatrix: this.transform.toRowMajorArray(),
          joints: this.skinnedModel.joints,
        };
        worker.onmessage = (e) => {
          onProgress(e.data.progress);
          if (e.data.done && e.data.indices) {
            const skinData = {};
            const positionInBindPose = {};
            landmarkList.forEach((key) => {
              const index = e.data.indices[key];
              skinData[key] = {
                weights: self.getSkinningWeights(index),
                indices: self.getSkinningIndices(index),
              };
              const [x, y, z] = self.skinnedModel.getInverseSkinnedVertex(
                positions[key],
                skinData[key].weights,
                skinData[key].indices,
              );
              positionInBindPose[key] = [x, y, z];
              const disabled = landmarks[key].disabled || false;
              self.labels[key] = {
                index, x, y, z,
              };
              if (disabled) {
                self.labels[key].disabled = true;
              }
            });
            self.setDotsVertexData(gl, positionInBindPose, colors, skinData);
            onDone(self);
          }
        };
        worker.postMessage(load);
      } else {
        onError(new Error("Can't create Worker to compute normals"));
      }
    } else {
      this.setDotsVertexData(gl, positions, colors);
      onDone(this);
    }
  }
  setDotsVertexData(gl, positions, colors, skinData) {
    const dataArrays = {
      position: [],
      color: [],
    };
    if (skinData) {
      dataArrays.boneWeights = [];
      dataArrays.boneIndices = [];
      this.dotMemoryLayout = MemoryLayout.skinnedColoredVertexLayout();
    } else {
      this.dotMemoryLayout = MemoryLayout.coloredVertexLayout();
    }
    const landmarkList = Object.keys(positions);
    landmarkList.forEach((key) => {
      dataArrays.position = dataArrays.position.concat(positions[key]);
      dataArrays.color = dataArrays.color.concat(colors[key]);
      if (skinData) {
        dataArrays.boneWeights = dataArrays.boneWeights.concat(skinData[key].weights);
        dataArrays.boneIndices = dataArrays.boneIndices.concat(skinData[key].indices);
      }
    });
    if (dataArrays.position.length === 0) {
      return;
    }
    this.numDots = landmarkList.length;
    if (this.dotBuffer) {
      gl.deleteBuffer(this.dotBuffer);
    }
    const buffer = this.dotMemoryLayout.createInterleavedArrayBufferFromDataArrays(dataArrays);
    this.dotBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.dotBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, buffer, gl.STATIC_DRAW);
  }
  getTransformMatrix() {
    return this.transform.toColumnMajorArray();
  }
  getPosition(vertexIndex) {
    const i = 3 * vertexIndex;
    return this.dataArrays.position.slice(i, i + 3);
  }
  getSkinningWeights(vertexIndex) {
    const i = 4 * vertexIndex;
    return this.dataArrays.boneWeights.slice(i, i + 4);
  }
  getSkinningIndices(vertexIndex) {
    const i = 4 * vertexIndex;
    return this.dataArrays.boneIndices.slice(i, i + 4);
  }
  getSkinnedPosition(vertexIndex, position) {
    const pos = position || this.getPosition(vertexIndex);
    if (!this.skinnedModel) {
      return pos;
    }
    const skinnedPos = this.skinnedModel.getSkinnedVertex(
      pos,
      this.getSkinningWeights(vertexIndex),
      this.getSkinningIndices(vertexIndex),
    );
    return skinnedPos.slice(0, 3);
  }
  getPositionForLabel(labelId) {
    let pos = [0, 0, 0];
    const label = this.labels[labelId];
    if (label) {
      if (label.index) {
        // after baking, we store a vertex index so we can skin the labels
        if (label.x === undefined) {
          pos = this.getSkinnedPosition(label.index);
        } else {
          pos = VMath.readCoordinates(label).slice(0, 3);
          pos = this.getSkinnedPosition(label.index, pos);
        }
      } else {
        pos = VMath.readCoordinates(label).slice(0, 3);
      }
    }
    return pos;
  }
  getSurfaceIntersection(ray, onDone) {
    if (window.Worker) {
      const worker = new Worker('./js/modelDistanceWorker.js');
      const load = {
        ray,
        dataArrays: this.dataArrays,
        triangles: this.triangles,
        transformMatrix: this.transform.toRowMajorArray(),
      };
      if (this.skinnedModel) {
        load.joints = this.skinnedModel.joints;
      }
      worker.onmessage = (e) => {
        if (e.data.done && e.data.surfaceIntersection) {
          onDone(e.data.surfaceIntersection);
        }
      };
      worker.postMessage(load);
    } else {
      console.error("Can't create Worker to find surface intersections");
    }
  }
  getBoundingBox(onDone) {
    if (window.Worker) {
      const worker = new Worker('./js/modelDistanceWorker.js');
      const boundingBox = {
        min: { x: Number.MAX_VALUE, y: Number.MAX_VALUE, z: Number.MAX_VALUE },
        max: { x: Number.MIN_VALUE, y: Number.MIN_VALUE, z: Number.MIN_VALUE },
      };
      const load = {
        boundingBox,
        dataArrays: this.dataArrays,
        triangles: this.triangles,
        transformMatrix: this.transform.toRowMajorArray(),
      };
      if (this.skinnedModel) {
        load.joints = this.skinnedModel.joints;
      }
      worker.onmessage = (e) => {
        if (e.data.done && e.data.boundingBox) {
          onDone(e.data.boundingBox);
        }
      };
      worker.postMessage(load);
    } else {
      console.error("Can't create Worker to find bounding box");
    }
  }
}
export { Model as default };
