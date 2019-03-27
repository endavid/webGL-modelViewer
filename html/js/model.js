import Gfx from './gfx.js';
import VMath from './math.js';
import SkinnedModel from './skinnedModel.js';

function readColor(landmark) {
  let color = [1, 1, 1];
  if (landmark.color !== undefined) {
    color = VMath.hexColorToNormalizedVector(landmark.color);
  }
  const alpha = 1.0;
  return color.concat(alpha);
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
  constructor(gl, json, imageUrls) {
    this.name = json.name;
    this.meterUnits = json.meterUnits || 1;
    this.transformMatrix = VMath.getI4();
    // vertices
    this.vertexBuffer = gl.createBuffer();
    this.stride = json.stride;
    console.log(`#vertices: ${json.vertices.length / json.stride}`);
    if (json.skin) {
      this.skinnedModel = new SkinnedModel(json.skin, json.skeleton, json.anims);
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
    json.meshes.forEach((m) => {
      const mat = m.material !== undefined ? json.materials[m.material] || {} : {};
      const albedoMapName = mat.albedoMap || 'missing';
      // if the .dds texture is missing, try to find equivalent .png
      const albedoMapUrl = imageUrls[albedoMapName] || imageUrls[`${Gfx.getFileNameWithoutExtension(albedoMapName)}.png`];
      const mesh = {
        indexBuffer: gl.createBuffer(),
        numPoints: m.indices.length,
        albedoMap: albedoMapUrl !== undefined ? Gfx.loadTexture(gl, albedoMapUrl) : false,
      };
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,
        new Uint32Array(m.indices), // 32-bit for more than 64K verts
        gl.STATIC_DRAW);
      meshes.push(mesh);
    });
    this.meshes = meshes;
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
        if (config.recomputeNormals) {
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
                onDone(new Model(gl, jsonRef, imageUrls));
              }
            };
            worker.postMessage(load);
          } else {
            throw new Error("Can't create Worker to compute normals");
          }
        } else {
          onDone(new Model(gl, json, imageUrls));
        }
      })
      .catch(onError);
  }
  setDots(gl, landmarks, labelScale, onProgress, onDone, onError) {
    const self = this;
    const landmarkList = Object.keys(landmarks);
    const positions = {};
    const colors = {};
    landmarkList.forEach((key) => {
      const p = landmarks[key];
      const pos = VMath.readCoordinates(p).slice(0, 3);
      const posScaled = VMath.mulScalar(pos, labelScale);
      positions[key] = posScaled;
      colors[key] = readColor(p);
    });
    if (this.skinnedModel) {
      if (window.Worker) {
        const worker = new Worker('./js/modelDistanceWorker.js');
        const load = {
          positions,
          vertices: this.vertices,
          stride: this.stride,
          transformMatrix: this.transformMatrix,
          joints: this.skinnedModel.joints,
        };
        worker.onmessage = (e) => {
          onProgress(e.data.progress);
          if (e.data.done && e.data.indices) {
            const skinData = {};
            landmarkList.forEach((key) => {
              const index = e.data.indices[key];
              skinData[key] = self.getSkinningData(index);
            });
            this.setDotsVertexData(gl, positions, colors, skinData);
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
  getSkinningData(vertexIndex) {
    const i = vertexIndex * this.stride;
    return this.vertices.slice(i + 8, i + 16);
  }
}
export { Model as default };
