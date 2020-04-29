import Shader from './shader.js';
import PluginLitModel from './pluginLitModel.js'

/** Renders the intersection volume of a mesh, using stencil buffer operations */
class PluginIntersection {
  constructor(shaders, whiteTexture) {
    this.shaders = shaders;
    this.whiteTexture = whiteTexture;
    this.doLightPass = false;
  }
  static async createAsync(gl, whiteTexture) {
    const attribs = ['uv', 'position', 'normal'];
    const uniforms = ['Pmatrix', 'Vmatrix', 'Mmatrix', 'lightDirection', 'lightIrradiance', 'sampler'];
    const attribsSkin = attribs.concat(['boneWeights', 'boneIndices']);
    const uniformsSkin = uniforms.concat(['joints', 'jointDebugPalette']);
    const shaders = {
      flat: {},
      light: {}
    };
    const fs = {
      flat: 'shaders/lightColor.fs',
      light: 'shaders/lighting.fs'
    };
    const vs = {
      geom: 'shaders/geometry.vs',
      skin: 'shaders/skinning.vs'
    }
    shaders.flat.lit = await Shader.createAsync(gl, vs.geom, fs.flat, attribs, uniforms);
    shaders.flat.litSkin = await Shader.createAsync(gl, vs.skin, fs.flat, attribsSkin, uniformsSkin);
    shaders.light.lit = await Shader.createAsync(gl, vs.geom, fs.light, attribs, uniforms);
    shaders.light.litSkin = await Shader.createAsync(gl, vs.skin, fs.light, attribsSkin, uniformsSkin);
    return new PluginIntersection(shaders, whiteTexture);
  }
  static setBackPass(glState) {
    const { gl } = glState;
    glState.setBlend(false)
    glState.setDepthTest(true);
    glState.setDepthMask(true);
    glState.setStencilTest(true);
    glState.setCullFace(glState.Cull.front);
    glState.setStencilFunc(gl.ALWAYS, 0, 0);
    glState.setStencilMask(0xffffffff);
    glState.setStencilOp(gl.KEEP, gl.INCR, gl.INCR);
  }
  static setFrontPass(glState) {
    const { gl } = glState;
    glState.setDepthMask(false);
    glState.setCullFace(glState.Cull.back);
    glState.setStencilFunc(gl.ALWAYS, 0, 0x0);
    glState.setStencilMask(0xffffffff);
    glState.setStencilOp(gl.KEEP, gl.DECR, gl.KEEP);
  }
  static setIntersectionPass(glState) {
    const { gl } = glState;
    glState.setDepthMask(true);
    glState.setCullFace(glState.Cull.back);
    glState.setStencilFunc(gl.LESS, 0x01, 0xffffffff);
    glState.setStencilMask(0xffffffff);
    glState.setStencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
  }
  static setLightPass(glState) {
    const { gl } = glState;
    glState.setDepthMask(true);
    glState.setCullFace(glState.Cull.back);
    glState.setStencilFunc(gl.GEQUAL, 0x01, 0xffffffff);
    glState.setStencilMask(0xffffffff);
    glState.setStencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
  }
  draw(glState, scene, camera) {
    const args = {
      camera,
      whiteTexture: this.whiteTexture,
      gl: glState.gl,
      scene: {
        selectedMesh: scene.selectedMesh,
        lights: [
          { 
            irradiance: [0, 1, 0],
            direction: scene.lights[0].direction
          }
        ]
      },
      normalShader: this.shaders.flat.lit,
      skinShader: this.shaders.flat.litSkin
    }
    const drawModel = PluginLitModel.drawModel.bind(this, args);
    PluginIntersection.setBackPass(glState);
    scene.models.forEach(drawModel);
    PluginIntersection.setFrontPass(glState);
    args.scene.lights[0].irradiance = [0, 1, 1, 1];
    scene.models.forEach(drawModel);
    PluginIntersection.setIntersectionPass(glState);
    args.scene.lights[0].irradiance = [1, 0, 0, 1];
    scene.models.forEach(drawModel);
    if (this.doLightPass) { // optional
      PluginIntersection.setLightPass(glState);
      args.scene.lights[0].irradiance = scene.lights[0].irradiance;
      args.normalShader = this.shaders.light.lit;
      args.skinShader = this.shaders.light.litSkin;
      scene.models.forEach(drawModel);
    }
  }
}
export { PluginIntersection as default };
