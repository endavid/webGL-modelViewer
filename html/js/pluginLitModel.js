import Shader from './shader.js';

class PluginLitModel {
  constructor(shaders, whiteTexture) {
    this.shaders = shaders;
    this.whiteTexture = whiteTexture;
  }
  static async createAsync(gl, whiteTexture, fragmentShader) {
    const attribs = ['uv', 'position', 'normal'];
    const uniforms = ['Pmatrix', 'Vmatrix', 'Mmatrix', 'lightDirection', 'sampler'];
    const attribsSkin = attribs.concat(['boneWeights', 'boneIndices']);
    const uniformsSkin = uniforms.concat(['joints', 'jointDebugPalette']);
    const shaders = {};
    const fs = fragmentShader || 'shaders/lighting.fs';
    shaders.lit = await Shader.createAsync(gl, 'shaders/geometry.vs', fs, attribs, uniforms);
    shaders.litSkin = await Shader.createAsync(gl, 'shaders/skinning.vs', fs, attribsSkin, uniformsSkin);
    return new PluginLitModel(shaders, whiteTexture);
  }
  static setOpaquePass(glState) {
    glState.setDepthTest(true);
    glState.setDepthMask(true);
    glState.setCullFace(true);
    glState.setBlend(false);
  }
  draw(glState, scene) {
    const self = this;
    const { whiteTexture } = this;
    const { gl } = glState;
    const { camera, lights } = scene;
    const [light0] = lights;
    PluginLitModel.setOpaquePass(glState);
    scene.models.forEach((model) => {
      if (!model.vertexBuffer) {
        return;
      }
      const skinned = model.skinnedModel;
      const shader = skinned ? self.shaders.litSkin : self.shaders.lit;
      const stride = 4 * model.stride; // in bytes
      shader.use(gl);
      gl.uniform1i(shader.uniforms.sampler, 0);
      gl.uniformMatrix4fv(shader.uniforms.Pmatrix, false, camera.projectionMatrix);
      gl.uniformMatrix4fv(shader.uniforms.Vmatrix, false, camera.viewMatrix);
      gl.uniformMatrix4fv(shader.uniforms.Mmatrix, false, model.transformMatrix);
      gl.uniform3f(shader.uniforms.lightDirection,
        light0.direction[0], light0.direction[1], light0.direction[2]);
      gl.bindBuffer(gl.ARRAY_BUFFER, model.vertexBuffer);
      gl.vertexAttribPointer(shader.attribs.position, 3, gl.FLOAT, false, stride, 0);
      gl.vertexAttribPointer(shader.attribs.normal, 3, gl.FLOAT, false, stride, 4 * 3);
      gl.vertexAttribPointer(shader.attribs.uv, 2, gl.FLOAT, false, stride, 4 * (3 + 3));
      if (skinned) {
        gl.vertexAttribPointer(shader.attribs.boneWeights,
          4, gl.FLOAT, false, stride, 4 * (3 + 3 + 2));
        gl.vertexAttribPointer(shader.attribs.boneIndices,
          4, gl.FLOAT, false, stride, 4 * (3 + 3 + 2 + 4));
        gl.uniformMatrix4fv(shader.uniforms.joints, false, skinned.joints);
        gl.uniform4fv(shader.uniforms.jointDebugPalette, skinned.jointColorPalette);
      }
      // draw all submeshes
      model.meshes.forEach((mesh) => {
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
    });
  }
}
export { PluginLitModel as default };
