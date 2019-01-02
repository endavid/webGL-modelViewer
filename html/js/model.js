import GFX from './gfx.js';
import MATH from './math.js';
import SkinnedModel from './skinnedModel.js';
import ModelData from './modelData.js';

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
    this.transformMatrix = MATH.getI4();
    //vertices
    this.vertexBuffer= gl.createBuffer();
    this.stride = json.stride;
    console.log("#vertices: " + (json.vertices.length/json.stride));
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
    //submeshes
    var meshes = [];
    json.meshes.forEach(m => {
      const mat = m.material !== undefined ? json.materials[m.material] || {} : {};
      const albedoMapName = mat.albedoMap || "missing";
      // if the .dds texture is missing, try to find equivalent .png
      var albedoMapUrl = imageUrls[albedoMapName] || imageUrls[GFX.getFileNameWithoutExtension(albedoMapName)+".png"];
      var mesh = {
        indexBuffer: gl.createBuffer(),
        numPoints: m.indices.length,
        albedoMap: albedoMapUrl !== undefined ? GFX.loadTexture(gl, albedoMapUrl) : false
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
    GFX.destroyBuffers(gl, this);
  }
  static createAsync(gl, name, url, config, imageUrls, materialUrls) {
    return GFX.modelFileToJson(name, url, materialUrls).then(json => {
      let modelData = new ModelData(json);
      if (config.isZAxisUp) {
        GFX.flipAxisZ(json);
      }
      if (config.recomputeNormals) {
        modelData.recomputeNormals();
      }
      return new Model(gl, json, imageUrls);
    });
  }
}
export {Model as default};