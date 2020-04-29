import Shader from './shader.js';

// Renders dots in 3D
class PluginDots {
  constructor(shaders) {
    this.shaders = shaders;
    this.pointSize = 3.0;
    this.tint = [1, 1, 1, 1];
  }
  static async createAsync(gl) {
    const attribs = ['position', 'color'];
    const uniforms = ['Pmatrix', 'Vmatrix', 'Mmatrix', 'pointSize', 'tint'];
    const attribsSkin = attribs.concat(['boneWeights', 'boneIndices']);
    const uniformsSkin = uniforms.concat(['joints']);
    const shaders = {};
    const fs = 'shaders/outColor.fs';
    shaders.normal = await Shader.createAsync(gl, 'shaders/dotGeometry.vs', fs, attribs, uniforms);
    shaders.skin = await Shader.createAsync(gl, 'shaders/dotSkinning.vs', fs, attribsSkin, uniformsSkin);
    return new PluginDots(shaders);
  }
  static setOpaquePass(glState) {
    glState.setDepthTest(true);
    glState.setDepthMask(true);
    glState.setCullFace(glState.Cull.none);
    glState.setBlend(false);
    glState.setDefaultStencil();
    glState.setStencilTest(false);
  }
  draw(glState, scene, camera) {
    if (!scene.labels.showPoints) {
      return;
    }
    const self = this;
    const { gl } = glState;
    PluginDots.setOpaquePass(glState);
    scene.models.forEach((model) => {
      if (!model || !model.dotBuffer) {
        return;
      }
      const skinned = model.skinnedModel;
      const shader = skinned ? self.shaders.skin : self.shaders.normal;
      const stride = 4 * model.dotBufferStride;
      shader.use(gl);
      gl.uniformMatrix4fv(shader.uniforms.Pmatrix, false, camera.projectionMatrix);
      gl.uniformMatrix4fv(shader.uniforms.Vmatrix, false, camera.viewMatrix);
      gl.uniformMatrix4fv(shader.uniforms.Mmatrix, false, model.getTransformMatrix());
      gl.uniform1f(shader.uniforms.pointSize, self.pointSize);
      gl.uniform4f(shader.uniforms.tint, self.tint[0], self.tint[1], self.tint[2], self.tint[3]);
      gl.bindBuffer(gl.ARRAY_BUFFER, model.dotBuffer);
      gl.vertexAttribPointer(shader.attribs.position, 3, gl.FLOAT, false, stride, 0);
      gl.vertexAttribPointer(shader.attribs.color, 4, gl.FLOAT, false, stride, 4 * 3);
      if (skinned) {
        gl.vertexAttribPointer(shader.attribs.boneWeights,
          4, gl.FLOAT, false, stride, 4 * (3 + 4));
        gl.vertexAttribPointer(shader.attribs.boneIndices,
          4, gl.FLOAT, false, stride, 4 * (3 + 4 + 4));
        gl.uniformMatrix4fv(shader.uniforms.joints, false, skinned.joints);
      }
      gl.drawArrays(gl.POINTS, 0, model.numDots);
      shader.disable(gl);
    });
  }
}

export { PluginDots as default };
