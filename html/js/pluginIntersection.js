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
  static setBackPass(glState, isBlend) {
    const { gl } = glState;
    glState.setBlend(isBlend);
    glState.setDepthTest(true);
    glState.setDepthMask(true);
    glState.setStencilTest(true);
    glState.setCullFace(glState.Cull.front);
    glState.setStencilFunc(gl.ALWAYS, 0, 0);
    glState.setStencilMask(0xffffffff);
    glState.setStencilOp(gl.KEEP, gl.INCR, gl.INCR);
  }
  static setFrontPass(glState, isBlend) {
    const { gl } = glState;
    glState.setBlend(isBlend);
    glState.setDepthMask(false);
    glState.setCullFace(glState.Cull.back);
    glState.setStencilFunc(gl.ALWAYS, 0, 0x0);
    glState.setStencilMask(0xffffffff);
    glState.setStencilOp(gl.KEEP, gl.DECR, gl.KEEP);
  }
  static setIntersectionPass(glState, isBlend) {
    const { gl } = glState;
    glState.setBlend(isBlend);
    glState.setDepthMask(true);
    glState.setCullFace(glState.Cull.back);
    glState.setStencilFunc(gl.LESS, 0x01, 0xffffffff);
    glState.setStencilMask(0xffffffff);
    glState.setStencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
  }
  static setLightPass(glState, isBlend) {
    const { gl } = glState;
    glState.setBlend(isBlend);
    glState.setDepthMask(true);
    glState.setCullFace(glState.Cull.back);
    glState.setStencilFunc(gl.GEQUAL, 0x01, 0xffffffff);
    glState.setStencilMask(0xffffffff);
    glState.setStencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
  }
  draw(glState, scene, view) {
    const { camera } = view;
    const irradiance = scene.lights[0].irradiance;
    const alpha = irradiance[3];
    const isBlend = alpha < 0.99;
    const flatColorAlpha = isBlend ? (this.doLightPass ? 0 : alpha) : 1;
    const args = {
      camera,
      whiteTexture: this.whiteTexture,
      gl: glState.gl,
      scene: {
        selectedMesh: scene.selectedMesh,
        lights: [
          { 
            irradiance: [0, 1, 0, flatColorAlpha],
            direction: scene.lights[0].direction
          }
        ]
      },
      normalShader: this.shaders.flat.lit,
      skinShader: this.shaders.flat.litSkin
    }
    const drawModel = PluginLitModel.drawModel.bind(this, args);
    PluginIntersection.setBackPass(glState, isBlend);
    scene.models.forEach(drawModel);
    PluginIntersection.setFrontPass(glState, isBlend);
    args.scene.lights[0].irradiance = [0, 1, 1, flatColorAlpha];
    scene.models.forEach(drawModel);
    PluginIntersection.setIntersectionPass(glState, isBlend);
    args.scene.lights[0].irradiance = [1, 0, 0, alpha];
    scene.models.forEach(drawModel);
    if (this.doLightPass) { // optional
      const irradiance = scene.lights[0].irradiance;
      PluginIntersection.setLightPass(glState, isBlend);
      args.scene.lights[0].irradiance = irradiance;
      args.normalShader = this.shaders.light.lit;
      args.skinShader = this.shaders.light.litSkin;
      scene.models.forEach(drawModel);
    }
  }
}
export { PluginIntersection as default };
