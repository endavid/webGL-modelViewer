import GFX from './libs.js';

class Shader {
  constructor(gl, program, attribs, uniforms) {
    var self = this;
    self.program = program;
    self.attribs = {};
    self.uniforms = {};
    attribs.forEach(function (a) {
      self.attribs[a] = gl.getAttribLocation(program, a);
    });
    uniforms.forEach(function (u) {
      self.uniforms[u] = gl.getUniformLocation(program, u);
    });
  }
  static createAsync(gl, vs, fs, attribs, uniforms) {
    return GFX.useShader(gl, vs, fs).then(program => {
      return new Shader(gl, program, attribs, uniforms);
    });
  }
  enableVertexAttributes(gl) {
    const attribKeys = Object.keys(this.attribs);
    for (let i = 0; i < attribKeys.length; i++) {
      gl.enableVertexAttribArray(this.attribs[attribKeys[i]]);
    }
  }
  disableVertexAttributes(gl) {
    const attribKeys = Object.keys(this.attribs);
    for (let i = 0; i < attribKeys.length; i++) {
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

export {Shader as default};