import Gfx from './gfx.js';

class Shader {
  constructor(gl, program, attribs, uniforms) {
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
  }
  static async createAsync(gl, vs, fs, attribs, uniforms) {
    const program = await Gfx.useShader(gl, vs, fs);
    return new Shader(gl, program, attribs, uniforms);
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
