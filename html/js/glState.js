import VMath from './math.js';

class GlState {
  constructor(gl) {
    this.gl = gl;
    this.setDepthTest(true);
    this.setDepthMask(true);
    this.setStencilTest(false);
    this.setBlend(false);
    this.clearColor = 0x0;
    this.stacks = {
      framebuffer: [],
      renderbuffer: [],
    };
    gl.clearColor(0, 0, 0, 1);
    gl.clearDepth(1.0);
    gl.clearStencil(0);
    gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthFunc(gl.LEQUAL);
    this.Cull = {
      none: gl.NONE,
      front: gl.FRONT,
      back: gl.BACK,
      both: gl.FRONT_AND_BACK
    };
    this.cullFace = this.Cull.none;
    this.stencilOp = {
      fail: gl.KEEP,
      zfail: gl.KEEP,
      zpass: gl.KEEP
    };
    this.stencilFunc = {
      func: gl.ALWAYS,
      ref: 0,
      // read mask
      mask: 0xffffffff
    };
    // write mask
    this.stencilMask = 0xffffffff;
  }
  setClearColor(rgb) {
    if (rgb !== this.clearColor) {
      this.clearColor = rgb;
      const v = VMath.rgbToFloat(rgb);
      this.gl.clearColor(v[0], v[1], v[2], 1);
    }
  }
  setScissorTest(enable) {
    if (this.scissorTest !== enable) {
      this.scissorTest = enable;
      this.glToggle(enable, this.gl.SCISSOR_TEST);
    }
  }
  setDepthTest(enable) {
    if (this.depthTest !== enable) {
      this.depthTest = enable;
      this.glToggle(enable, this.gl.DEPTH_TEST);
    }
  }
  setStencilTest(enable) {
    if (this.stencilTest !== enable) {
      this.stencilTest = enable;
      this.glToggle(enable, this.gl.STENCIL_TEST);
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
  setCullFace(mode) {
    if (this.cullFace === mode) {
      return;
    }
    if (mode === this.Cull.none) {
      this.glToggle(false, this.gl.CULL_FACE);
      this.cullFace = mode;
      return;
    }
    if (this.cullFace === this.Cull.none) {
      this.glToggle(true, this.gl.CULL_FACE);
    }
    this.gl.cullFace(mode);
    this.cullFace = mode;
  }
  setStencilOp(fail, zfail, zpass) {
    if (this.stencilOp.fail === fail 
      && this.stencilOp.zfail === zfail
      && this.stencilOp.zpass === zpass) {
        return;
    }
    this.gl.stencilOp(fail, zfail, zpass);
    this.stencilOp.fail = fail;
    this.stencilOp.zfail = zfail;
    this.stencilOp.zpass = zpass;
  }
  setStencilFunc(func, ref, mask) {
    if (this.stencilFunc.func === func
      && this.stencilFunc.ref === ref
      && this.stencilFunc.mask === mask) {
      return;
    }
    // https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/stencilFuncSeparate
    // oh, if only it weren't illegal to use Separate... duh!
    // https://stackoverflow.com/a/38272458
    // glDrawElements: Front/back stencil settings do not match.
    this.gl.stencilFunc(func, ref, mask);
    this.stencilFunc.func = func;
    this.stencilFunc.ref = ref;
    this.stencilFunc.mask = mask;
  }
  setStencilMask(mask) {
    if (this.stencilMask === mask) {
      return;
    }
    this.gl.stencilMask(mask);
    this.stencilMask = mask;
  }
  setDefaultStencil() {
    const { gl } = this;
    this.setStencilFunc(gl.ALWAYS, 0, 0xffffffff);
    this.setStencilMask(0xffffffff);
    this.setStencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
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
  scissor(x, y, w, h) {
    this.gl.scissor(x, y, w, h);
  }
  clear() {
    const { gl } = this;
    // eslint-disable-next-line no-bitwise
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
  }
  flush() {
    this.gl.flush();
  }
  pushFramebuffer() {
    const fb = this.gl.getParameter(this.gl.FRAMEBUFFER_BINDING);
    this.stacks.framebuffer.push(fb);
  }
  pushRenderbuffer() {
    const rb = this.gl.getParameter(this.gl.RENDERBUFFER_BINDING);
    this.stacks.renderbuffer.push(rb);
  }
  popFramebuffer() {
    const fb = this.stacks.framebuffer.pop();
    if (fb) {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, fb);
    } else {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    }
  }
  popRenderbuffer() {
    const rb = this.stacks.renderbuffer.pop();
    if (rb) {
      this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, rb);
    } else {
      this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, null);
    }
  }
  setTextureParameters(filter, wrap) {
    const { gl } = this;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  }
}
export { GlState as default };
