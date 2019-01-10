import VMath from './math.js';

class GlState {
  constructor(gl) {
    this.gl = gl;
    this.setDepthTest(true);
    this.setDepthMask(true);
    this.setBlend(false);
    this.clearColor = 0x0;
    gl.clearColor(0, 0, 0, 1);
    gl.clearDepth(1.0);
    gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthFunc(gl.LEQUAL);
  }
  setClearColor(rgb) {
    if (rgb !== this.clearColor) {
      this.clearColor = rgb;
      const v = VMath.rgbToFloat(rgb);
      this.gl.clearColor(v[0], v[1], v[2], 1);
    }
  }
  setDepthTest(enable) {
    if (this.depthTest !== enable) {
      this.depthTest = enable;
      this.glToggle(enable, this.gl.DEPTH_TEST);
    }
  }
  setBlend(enable) {
    if (this.blend !== enable) {
      this.blend = enable;
      this.glToggle(enable, this.gl.BLEND);
    }
  }
  setDepthMask(enable) {
    if (this.depthMath !== enable) {
      this.depthMask = enable;
      this.gl.depthMask(enable); // ZWRITE
    }
  }
  setCullFace(enable) {
    if (this.cullFace !== enable) {
      this.cullFace = enable;
      this.glToggle(enable, this.gl.CULL_FACE);
    }
  }
  glToggle(enable, flag) {
    if (enable) {
      this.gl.enable(flag);
    } else {
      this.gl.disable(flag);
    }
  }
  viewport(x, y, w, h) {
    this.gl.viewport(x, y, w, h);
  }
  clear() {
    const { gl } = this;
    // eslint-disable-next-line no-bitwise
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }
  flush() {
    this.gl.flush();
  }
}
export { GlState as default };
