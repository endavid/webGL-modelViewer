import Shader from './shader.js';

class PluginLitModel {
  constructor(shaders, whiteTexture) {
    this.shaders = shaders;
    this.whiteTexture = whiteTexture;
  }
  static async createAsync(gl, whiteTexture, fragmentShader) {
    const attribs = ['uv', 'position', 'normal'];
    const uniforms = ['Pmatrix', 'Vmatrix', 'Mmatrix', 'lightDirection', 'lightIrradiance', 'sampler'];
    const attribsSkin = attribs.concat(['boneWeights', 'boneIndices']);
    const uniformsSkin = uniforms.concat(['joints', 'jointDebugPalette']);
    const shaders = {};
    const fs = fragmentShader || 'shaders/lighting.fs';
    shaders.lit = await Shader.createAsync(gl, 'shaders/geometry.vs', fs, attribs, uniforms);
    shaders.litSkin = await Shader.createAsync(gl, 'shaders/skinning.vs', fs, attribsSkin, uniformsSkin);
    return new PluginLitModel(shaders, whiteTexture);
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
    const { camera, whiteTexture, gl, scene, normalShader, skinShader } = args;
    const [light] = scene.lights;
    const skinned = model.skinnedModel;
    const shader = skinned ? skinShader : normalShader;
    const stride = 4 * model.stride; // in bytes
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
    const irradiance = scene.lights[0].irradiance;
    PluginLitModel.setDepthPass(glState, irradiance[3] < 0.99);
    const args = {
      camera: camera,
      whiteTexture: this.whiteTexture,
      gl: glState.gl,
      scene: scene,
      normalShader: this.shaders.lit,
      skinShader: this.shaders.litSkin
    }
    const drawModel = PluginLitModel.drawModel.bind(this, args);
    scene.models.forEach(drawModel);
  }
}
export { PluginLitModel as default };
