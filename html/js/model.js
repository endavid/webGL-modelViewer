import Gfx from './gfx.js';
import VMath from './math.js';
import SkinnedModel from './skinnedModel.js';
import Transform from './transform.js';
import MemoryLayout from './memoryLayout.js';

function readColor(landmark) {
  let color = [1, 1, 1];
  if (landmark.color !== undefined) {
    color = VMath.hexColorToNormalizedVector(landmark.color);
  }
  const alpha = 1.0;
  return color.concat(alpha);
}

function getModelStats(json) {
  const stats = {
    vertexCount: json.dataArrays.position.length / 3,
    meshCount: json.meshes.length,
    missingUVs: json.missingUVs ? true : false,
    missingNormals: json.missingNormals ? true : false
  };
  if (json.skin) {
    stats.jointCount = json.skin.joints.length;
    stats.maxJointsPerVertex = json.skin.maxJointCount;
  }
  return stats;
}

function chunkedAndSorted(array, chunkSize) {
  let out = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    let t = array.slice(i, i+chunkSize);
    t.sort();
    out.push(t);
  }
  return out;
}

function vertexNeighbors(triangles) {
  let neighbors = {};
  triangles.forEach((triangle) => {
    triangle.forEach((vertexIndex) => {
      if (!Array.isArray(neighbors[vertexIndex])) {
        neighbors[vertexIndex] = [];
      }
      triangle.forEach((v) => {
        if (v != vertexIndex && !neighbors[vertexIndex].includes(v)) {
          neighbors[vertexIndex].push(v);
        }
      });
    });
  });
  return neighbors;
}

function chaitinColorSort(vertexCount, triangles, k) {
  let neighbors = vertexNeighbors(triangles);
  let vertices = Array.apply(null, Array(vertexCount)).map((_, i) => {return i});
  let sorted = [];
  while (vertices.length > 0) {
    let found = false;
    for (let i = 0; i < vertices.length; i++) {
      const vertexIndex = vertices[i];
      let ns = neighbors[vertexIndex];
      if (ns.length < k) {
        sorted.push(vertexIndex);
        vertices.splice(i, 1);
        ns.forEach((v) => {
          // remove vertex from the known neighbors
          neighbors[v] = neighbors[v].filter((x) => { return x != vertexIndex; });
        });
        found = true;
        break;
      }
    }
    if (!found) {
      k += 1;
      console.log(`chaitinColorSort: no candidates left! Increasing K=${k}`);
    }
  }
  return sorted;
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

// Vertex coloring. A planar graph is 4-colorable.
// A tetrahedron needs 4 colors, but most surfaces may be 3-colorable.
// We can use this function to paint vertices with
// barycentric coordinates.
function colorVertices(vertexCount, meshes, colors) {
  let labels = Array.apply(null, Array(vertexCount)).map(() => 0);
  let triangles = [];
  meshes.forEach((mesh) => {
    triangles = triangles.concat(chunkedAndSorted(mesh.indices, 3));
  });
  triangles.sort(arrayCmp);
  let sorted = triangles.reduce((acc, val) => acc.concat(val), []);
  //let sorted = chaitinColorSort(vertexCount, triangles, 3);
  let neighbors = vertexNeighbors(triangles);
  let maxIndex = 1;
  sorted.forEach((vertexIndex) => {
    let usedColors = [];
    neighbors[vertexIndex].forEach((v) => {
      if (labels[v] != 0) {
        usedColors.push(labels[v]);
      }
    });
    let colorIndex = 1;
    while (usedColors.includes(colorIndex)) {
      colorIndex+=1;
      maxIndex = Math.max(colorIndex, maxIndex);
    }
    labels[vertexIndex] = colorIndex;
  });
  console.log(`${maxIndex}-colorable.`)
  let flatColorData = [];
  labels.forEach((label) => {
    let color = label > 0 ? colors[(label-1)%colors.length] : 0;
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
      this.skinnedModel = new SkinnedModel(json.skin, json.skeleton, json.anims, armatureTransform, config);
    } else {
      this.skinnedModel = null;
    }
    // color with barycentric coordinates (1, 0, 0), (0, 1, 0), (0, 0, 1)
    json.dataArrays.color = colorVertices(this.stats.vertexCount, json.meshes, [
      0xff000000,
      0x00ff0000,
      0x0000ff00
    ]);
    this.memoryLayout = json.skin ? MemoryLayout.skinnedVertexLayout() : MemoryLayout.defaultVertexLayout();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    let arrayBuffer = this.memoryLayout.createInterleavedArrayBufferFromDataArrays(json.dataArrays);
    gl.bufferData(gl.ARRAY_BUFFER, arrayBuffer, gl.STATIC_DRAW);
    // for rendering purposes only, we don't need to remember .vertices,
    // but we will need them if we want to do things on the CPU side.
    this.dataArrays = json.dataArrays;
    // submeshes
    const meshes = [];
    let triangles = []; // again, remember for CPU computations
    json.meshes.forEach((m) => {
      const id = m.material || '';
      const mat = json.materials[id] || {};
      const albedoMapName = mat.albedoMap || 'missing';
      let albedoMapUrl = imageUrls[albedoMapName]
        // if the .dds texture is missing, try to find equivalent .png
        || imageUrls[`${Gfx.getFileNameWithoutExtension(albedoMapName)}.png`]
        // or use the 'missing' texture otherwise
        || imageUrls.missing;
      const mesh = {
        id,
        indexBuffer: gl.createBuffer(),
        numPoints: m.indices.length,
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
        if (config.isZAxisUp) {
          Gfx.flipAxisZ(json);
        }
        if (config.recomputeNormals || json.missingNormals) {
          if (window.Worker) {
            const worker = new Worker('./js/modelWorker.js');
            const load = {
              model: json,
              fn: 'recomputeNormals',
            };
            worker.onmessage = (e) => {
              onProgress(e.data.progress);
              if (e.data.done && e.data.vertices) {
                const jsonRef = json;
                jsonRef.vertices = e.data.vertices;
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
        colors[key][0] *= 0.5;
        colors[key][1] *= 0.5;
        colors[key][2] *= 0.5;
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
              skinData[key] = self.getSkinningData(index);
              const [x, y, z] = self.skinnedModel.getInverseSkinnedVertex(
                positions[key],
                skinData[key].slice(0, 4), // weights
                skinData[key].slice(4, 8), // indices
              );
              positionInBindPose[key] = [x, y, z];
              const disabled = landmarks[key].disabled || false;
              self.labels[key] = { index, x, y, z };
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
    let vertices = [];
    const landmarkList = Object.keys(positions);
    landmarkList.forEach((key) => {
      vertices = vertices.concat(positions[key]).concat(colors[key]);
      if (skinData) {
        vertices = vertices.concat(skinData[key]);
      }
    });
    if (vertices.length === 0) {
      return;
    }
    this.numDots = landmarkList.length;
    if (this.dotBuffer) {
      gl.deleteBuffer(this.dotBuffer);
    }
    this.dotBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.dotBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    this.dotBufferStride = 3 + 4; // position + rgba
    if (skinData) {
      this.dotBufferStride += 4 + 4; // 4 weights + 4 indices
    }
  }
  getTransformMatrix() {
    return this.transform.toColumnMajorArray();
  }
  getPosition(vertexIndex) {
    const i = 3 * vertexIndex;
    return this.dataArrays.position.slice(i, i + 3);
  }
  getSkinningData(vertexIndex) {
    const i = vertexIndex * this.stride;
    return this.vertices.slice(i + 9, i + 17);
  }
  getSkinnedPosition(vertexIndex, position) {
    const pos = position || this.getPosition(vertexIndex);
    if (!this.skinnedModel) {
      return pos;
    }
    const skinning = this.getSkinningData(vertexIndex);
    const skinnedPos = this.skinnedModel.getSkinnedVertex(
      pos,
      skinning.slice(0, 4), // weights
      skinning.slice(4, 8), // indices
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
        min: {x: Number.MAX_VALUE, y: Number.MAX_VALUE, z: Number.MAX_VALUE},
        max: {x: Number.MIN_VALUE, y: Number.MIN_VALUE, z: Number.MIN_VALUE},
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
