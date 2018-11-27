attribute vec3 position;
varying vec2 vUV;
uniform vec2 scale;
uniform vec2 offset;
void main(void) {
  gl_Position = vec4(position.xy * scale + offset, position.z, 1.);
  vUV = 0.5 * position.xy + 0.5;
}
