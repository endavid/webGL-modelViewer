import Shader from './shader.js';
import Gfx from './gfx.js';

class PluginOverlay {
  constructor(gl, shader) {
    this.shader = shader;
    this.quad = Gfx.createQuad(gl);
  }
  static async createAsync(gl) {
    const attribs = ['position'];
    const uniforms = ['scale', 'offset', 'colourTransform', 'colourBias'];
    const shader = await Shader.createAsync(gl, 'shaders/fullscreen.vs', 'shaders/colour.fs', attribs, uniforms);
    return new PluginOverlay(gl, shader);
  }
  static setBlendPass(glState) {
    glState.setDepthTest(false);
    glState.setDepthMask(false);
    glState.setCullFace(glState.Cull.none);
    glState.setBlend(true);
    glState.setDefaultStencil();
    glState.setStencilTest(false);
  }
  setOverlayParameters(gl, overlay) {
    const { shader } = this;
    gl.uniform2f(shader.uniforms.scale, 1, 1);
    gl.uniform2f(shader.uniforms.offset, 0, 0);
    gl.uniform4f(shader.uniforms.colourBias, 0, 0, 0, 0);
    const a = overlay.alpha;
    const t = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, a];
    gl.uniformMatrix4fv(shader.uniforms.colourTransform, false, t);
  }
  draw(glState, scene, view) {
    const { overlay } = view;
    if (!overlay || !overlay.img) {
      return;
    }
    const { gl } = glState;
    PluginOverlay.setBlendPass(glState);
    this.shader.use(gl);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, overlay.img.webglTexture);
    this.setOverlayParameters(gl, overlay);
    this.drawFullScreenQuad(gl);
    this.shader.disable(gl);
  }
  drawFullScreenQuad(gl) {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad.vertexBuffer);
    gl.vertexAttribPointer(this.shader.attribs.position, 3, gl.FLOAT, false, 4 * 3, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.quad.indexBuffer);
    gl.drawElements(gl.TRIANGLE_STRIP, this.quad.faces.length, gl.UNSIGNED_SHORT, 0);
  }
}
export { PluginOverlay as default };
