import Gfx from './gfx.js';

class Shader {
  constructor(gl, program, attribs, uniforms, vs, fs) {
    const self = this;
    self.program = program;
    self.attribs = {};
    self.uniforms = {};
    attribs.forEach((a) => {
      self.attribs[a] = gl.getAttribLocation(program, a);
    });
    uniforms.forEach((u) => {
      self.uniforms[u] = gl.getUniformLocation(program, u);
    });
    // remember the location
    self.vs = vs;
    self.fs = fs;
  }
  static async createAsync(gl, vs, fs, attribs, uniforms, vsConstants) {
    const program = await Gfx.useShader(gl, vs, fs, vsConstants);
    // debug information
    console.log(`program(${vs}, ${fs})`);
    const info = Gfx.getProgramInfo(gl, program);
    console.table(info.uniforms);
    console.table(info.attributes);
    return new Shader(gl, program, attribs, uniforms, vs, fs);
  }
  enableVertexAttributes(gl) {
    const attribKeys = Object.keys(this.attribs);
    for (let i = 0; i < attribKeys.length; i += 1) {
      gl.enableVertexAttribArray(this.attribs[attribKeys[i]]);
    }
  }
  disableVertexAttributes(gl) {
    const attribKeys = Object.keys(this.attribs);
    for (let i = 0; i < attribKeys.length; i += 1) {
      gl.disableVertexAttribArray(this.attribs[attribKeys[i]]);
    }
  }
  use(gl) {
    gl.useProgram(this.program);
    this.enableVertexAttributes(gl);
  }
  disable(gl) {
    this.disableVertexAttributes(gl);
  }
}
export { Shader as default };
