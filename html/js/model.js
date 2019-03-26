import Gfx from './gfx.js';
import VMath from './math.js';
import SkinnedModel from './skinnedModel.js';

function readCoordinates(pos) {
  let color = [1, 1, 1];
  if (pos.color !== undefined) {
    color = VMath.hexColorToNormalizedVector(pos.color);
  }
  let p = [];
  if (pos.x !== undefined) {
    p = [pos.x, pos.y, pos.z];
  } else {
    p = pos.slice(0, 3);
  }
  const alpha = 1;
  return p.concat(color).concat(alpha);
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
  setDots(gl, landmarks) {
    let vertices = [];
    const landmarkList = Object.keys(landmarks);
    landmarkList.forEach((key) => {
      const p = landmarks[key];
      vertices = vertices.concat(readCoordinates(p));
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
  }
}
export { Model as default };
