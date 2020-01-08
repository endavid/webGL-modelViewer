precision mediump float;
varying vec4 vColor;
uniform vec4 tint;
void main(void) {
  gl_FragColor = vColor * tint;
}