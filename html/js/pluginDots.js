import Shader from './shader.js';
import PluginLitModel from './pluginLitModel.js'

// Renders dots in 3D
class PluginDots {
  constructor(shaders, vsConstants) {
    this.shaders = shaders;
    this.pointSize = 3.0;
    this.tint = [1, 1, 1, 1];
    this.vsConstants = vsConstants;
  }
  static getAttribs() {
    const attribs = ['position', 'color'];
    const uniforms = ['Pmatrix', 'Vmatrix', 'Mmatrix', 'pointSize', 'tint'];
    const attribsSkin = attribs.concat(['boneWeights', 'boneIndices']);
    const uniformsSkin = uniforms.concat(['joints']);
    return { attribs, uniforms, attribsSkin, uniformsSkin };
  }
  static async createAsync(gl, scene) {
    const {attribs, uniforms, attribsSkin, uniformsSkin } = PluginDots.getAttribs();
    const shaders = {};
    const fs = 'shaders/outColor.fs';
    const vsConstants = PluginLitModel.getVsConstants(scene);
    shaders.normal = await Shader.createAsync(gl, 'shaders/dotGeometry.vs', fs, attribs, uniforms);
    shaders.skin = await Shader.createAsync(gl, 'shaders/dotSkinning.vs', fs, attribsSkin, uniformsSkin, vsConstants);
    return new PluginDots(shaders, vsConstants);
  }
  static setOpaquePass(glState) {
    glState.setDepthTest(true);
    glState.setDepthMask(true);
    glState.setCullFace(glState.Cull.none);
    glState.setBlend(false);
    glState.setDefaultStencil();
    glState.setStencilTest(false);
  }
  draw(glState, scene, view) {
    if (!scene.labels.showPoints) {
      return;
    }
    const self = this;
    const { camera } = view;
    const { gl } = glState;
    PluginDots.setOpaquePass(glState);
    scene.models.forEach((model) => {
      if (!model || !model.dotBuffer) {
        return;
      }
      const skinned = model.skinnedModel;
      const shader = skinned ? self.shaders.skin : self.shaders.normal;
      const layout = model.dotMemoryLayout;
      const stride = layout.bytesPerLine;
      shader.use(gl);
      gl.uniformMatrix4fv(shader.uniforms.Pmatrix, false, camera.projectionMatrix);
      gl.uniformMatrix4fv(shader.uniforms.Vmatrix, false, camera.viewMatrix);
      gl.uniformMatrix4fv(shader.uniforms.Mmatrix, false, model.getTransformMatrix());
      gl.uniform1f(shader.uniforms.pointSize, self.pointSize);
      gl.uniform4f(shader.uniforms.tint, self.tint[0], self.tint[1], self.tint[2], self.tint[3]);
      gl.bindBuffer(gl.ARRAY_BUFFER, model.dotBuffer);
      gl.vertexAttribPointer(shader.attribs.position, 3, gl.FLOAT, false, stride, layout.byteOffsets.position);
      gl.vertexAttribPointer(shader.attribs.color, 4, gl.UNSIGNED_BYTE, true, stride, layout.byteOffsets.color);
      if (skinned) {
        gl.vertexAttribPointer(shader.attribs.boneWeights,
          4, gl.FLOAT, false, stride, layout.byteOffsets.boneWeights);
        gl.vertexAttribPointer(shader.attribs.boneIndices,
          4, gl.UNSIGNED_BYTE, false, stride, layout.byteOffsets.boneIndices);
        gl.uniformMatrix4fv(shader.uniforms.joints, false, skinned.joints);
      }
      gl.drawArrays(gl.POINTS, 0, model.numDots);
      shader.disable(gl);
    });
  }
  async onSceneUpdate(glState, scene) {
    const self = this;
    const vsConstants = PluginLitModel.getVsConstants(scene);
    let someDiffer = false;
    Object.keys(vsConstants).forEach((k) => {
      someDiffer = someDiffer || (self.vsConstants[k] != vsConstants[k]);
    });
    if (someDiffer) {
      const {attribsSkin, uniformsSkin } = PluginDots.getAttribs();
      const { vs, fs } = this.shaders.skin;
      this.shaders.skin = await Shader.createAsync(glState.gl, vs, fs, attribsSkin, uniformsSkin, vsConstants);
    }
  }
}

export { PluginDots as default };
