import Gfx from './gfx.js';
import VMath from './math.js';
import SkinnedModel from './skinnedModel.js';
import Transform from './transform.js';

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
    vertexCount: json.vertices.length / json.stride,
    meshCount: json.meshes.length,
  };
  if (json.skin) {
    stats.jointCount = json.skin.joints.length;
  }
  return stats;
}

class Model {
  // format:
  // { name: // model name
  //   materials: {
  //     "name": {
  //       albedoMap: "image.png",
  //     }
  //   },
  //   vertices: // float array in this order: position (3), normal (3), uv (2)
  //         // + weights (4) + joint indices (1 -- 4 bytes) for skinned models
  //   stride: 8 or 13
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
    this.stride = json.stride;
    this.stats = getModelStats(json);
    if (json.skin) {
      this.skinnedModel = new SkinnedModel(json.skin, json.skeleton, json.anims, armatureTransform, config);
    } else {
      this.skinnedModel = null;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    // atm, only floats allowed ...
    // but we should be able to mix with other datatypes
    // https://www.html5rocks.com/en/tutorials/webgl/typed_arrays/
    gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array(json.vertices),
      gl.STATIC_DRAW);
    // for rendering purposes only, we don't need to remember .vertices,
    // but we will need them if we want to do things on the CPU side.
    this.vertices = json.vertices;
    // submeshes
    const meshes = [];
    let triangles = []; // again, remember for CPU computations
    json.meshes.forEach((m) => {
      const id = m.material || '';
      const mat = json.materials[id] || {};
      const albedoMapName = mat.albedoMap || 'missing';
      // if the .dds texture is missing, try to find equivalent .png
      const albedoMapUrl = imageUrls[albedoMapName] || imageUrls[`${Gfx.getFileNameWithoutExtension(albedoMapName)}.png`];
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
          vertices: this.vertices,
          stride: this.stride,
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
    const i = vertexIndex * this.stride;
    return this.vertices.slice(i, i + 3);
  }
  getSkinningData(vertexIndex) {
    const i = vertexIndex * this.stride;
    return this.vertices.slice(i + 8, i + 16);
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
        vertices: this.vertices,
        triangles: this.triangles,
        stride: this.stride,
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
      console.error("Can't create Worker to compute normals");
    }
  }
}
export { Model as default };
