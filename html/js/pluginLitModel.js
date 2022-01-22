import Shader from './shader.js';

function getMaxBoneCount(scene) {
  let boneCount = 1;
  scene.models.forEach((model) => {
    if (model.skinnedModel) {
      boneCount = Math.max(boneCount, model.skinnedModel.jointCount);
    }
  });
  return boneCount;
}

class PluginLitModel {
  constructor(shaders, whiteTexture, vsConstants) {
    this.shaders = shaders;
    this.whiteTexture = whiteTexture;
    this.vsConstants = vsConstants;
  }
  static getAttribs() {
    const attribs = ['uv', 'position', 'normal', 'color'];
    const uniforms = ['Pmatrix', 'Vmatrix', 'Mmatrix', 'lightDirection', 'lightIrradiance', 'sampler'];
    const attribsSkin = attribs.concat(['objectId', 'boneWeights', 'boneIndices']);
    const uniformsSkin = uniforms.concat(['joints', 'jointDebugPalette']);
    return {
      attribs, uniforms, attribsSkin, uniformsSkin,
    };
  }
  static getVsConstants(scene) {
    const boneCount = getMaxBoneCount(scene);
    const vsConstants = {
      'const int BONE_COUNT': boneCount,
    };
    return vsConstants;
  }
  static async createAsync(gl, whiteTexture, fragmentShader, scene) {
    const {
      attribs, uniforms, attribsSkin, uniformsSkin,
    } = PluginLitModel.getAttribs();
    const shaders = {};
    const fs = fragmentShader || 'shaders/lighting.fs';
    const vsConstants = PluginLitModel.getVsConstants(scene);
    shaders.lit = await Shader.createAsync(gl, 'shaders/geometry.vs', fs, attribs, uniforms);
    shaders.litSkin = await Shader.createAsync(gl, 'shaders/skinning.vs', fs, attribsSkin, uniformsSkin, vsConstants);
    return new PluginLitModel(shaders, whiteTexture, vsConstants);
  }
  static setDepthPass(glState, isBlend) {
    glState.setBlend(isBlend);
    glState.setDepthTest(true);
    glState.setDepthMask(true);
    glState.setCullFace(glState.Cull.back);
    glState.setDefaultStencil();
    glState.setStencilTest(false);
  }
  static drawModel(args, model) {
    if (!model || !model.vertexBuffer) {
      return;
    }
    const {
      camera, whiteTexture, gl, scene, normalShader, skinShader,
    } = args;
    const [light] = scene.lights;
    const skinned = model.skinnedModel;
    const shader = skinned ? skinShader : normalShader;
    const layout = model.memoryLayout;
    const stride = layout.bytesPerLine;
    shader.use(gl);
    gl.uniform1i(shader.uniforms.sampler, 0);
    gl.uniformMatrix4fv(shader.uniforms.Pmatrix, false, camera.projectionMatrix);
    gl.uniformMatrix4fv(shader.uniforms.Vmatrix, false, camera.viewMatrix);
    gl.uniformMatrix4fv(shader.uniforms.Mmatrix, false, model.getTransformMatrix());
    gl.uniform3f(shader.uniforms.lightDirection,
      light.direction[0], light.direction[1], light.direction[2]);
    gl.uniform4f(shader.uniforms.lightIrradiance,
      light.irradiance[0], light.irradiance[1], light.irradiance[2], light.irradiance[3]);
    gl.bindBuffer(gl.ARRAY_BUFFER, model.vertexBuffer);
    gl.vertexAttribPointer(shader.attribs.position, 3, gl.FLOAT, false,
      stride, layout.byteOffsets.position);
    gl.vertexAttribPointer(shader.attribs.normal, 3, gl.FLOAT, false,
      stride, layout.byteOffsets.normal);
    gl.vertexAttribPointer(shader.attribs.uv, 2, gl.FLOAT, false,
      stride, layout.byteOffsets.uv);
    gl.vertexAttribPointer(shader.attribs.color, 4, gl.UNSIGNED_BYTE, true,
      stride, layout.byteOffsets.color);
    if (skinned) {
      gl.vertexAttribPointer(shader.attribs.objectId, 1, gl.FLOAT, false,
        stride, layout.byteOffsets.objectId);
      gl.vertexAttribPointer(shader.attribs.boneWeights,
        4, gl.FLOAT, false, stride, layout.byteOffsets.boneWeights);
      gl.vertexAttribPointer(shader.attribs.boneIndices,
        4, gl.UNSIGNED_BYTE, false, stride, layout.byteOffsets.boneIndices);
      gl.uniformMatrix4fv(shader.uniforms.joints, false, skinned.joints);
      const { debugJointCount } = scene.settings || {};
      gl.uniform4fv(shader.uniforms.jointDebugPalette,
        debugJointCount ? skinned.jointCountPalette : skinned.jointColorPalette);
    }
    // draw submeshes
    model.meshes.forEach((mesh) => {
      if (scene.selectedMesh) {
        if (mesh.id !== scene.selectedMesh) {
          return;
        }
      }
      gl.activeTexture(gl.TEXTURE0);
      const albedoMap = mesh.albedoMap || whiteTexture;
      const glTexture = albedoMap.webglTexture || whiteTexture.webglTexture;
      if (glTexture) {
        gl.bindTexture(gl.TEXTURE_2D, glTexture);
      } else {
        console.error('Not even the white texture is ready!');
      }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
      gl.drawElements(gl.TRIANGLES, mesh.numPoints, gl.UNSIGNED_INT, 0);
    });
    shader.disable(gl);
  }
  draw(glState, scene, view) {
    const { camera } = view;
    const { irradiance } = scene.lights[0];
    PluginLitModel.setDepthPass(glState, irradiance[3] < 0.99);
    const args = {
      camera,
      whiteTexture: this.whiteTexture,
      gl: glState.gl,
      scene,
      normalShader: this.shaders.lit,
      skinShader: this.shaders.litSkin,
    };
    const drawModel = PluginLitModel.drawModel.bind(this, args);
    scene.models.forEach(drawModel);
  }
  async onSceneUpdate(glState, scene) {
    const self = this;
    const vsConstants = PluginLitModel.getVsConstants(scene);
    let someDiffer = false;
    Object.keys(vsConstants).forEach((k) => {
      someDiffer = someDiffer || (self.vsConstants[k] !== vsConstants[k]);
    });
    if (someDiffer) {
      const { attribsSkin, uniformsSkin } = PluginLitModel.getAttribs();
      const { vs, fs } = this.shaders.litSkin;
      this.shaders.litSkin = await Shader.createAsync(
        glState.gl, vs, fs, attribsSkin, uniformsSkin, vsConstants,
      );
    }
  }
}
export { PluginLitModel as default };
