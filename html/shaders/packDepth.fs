precision mediump float;
uniform sampler2D sampler;
uniform vec3 lightDirection;
varying vec2 vUV;
varying vec3 vNormal;
varying vec3 worldPosition;
varying vec3 cameraPosition;
varying highp float viewDepth;
// https://forum.processing.org/two/discussion/6857/packing-depth-float-in-4-bytes
vec4 pack (float depth) {
  const vec4 bitSh = vec4(256 * 256 * 256,
                          256 * 256,
                          256,
                          1.0);
  const vec4 bitMsk = vec4(0,
                            1.0 / 256.0,
                            1.0 / 256.0,
                            1.0 / 256.0);
  vec4 comp = fract(depth * bitSh);
  comp -= comp.xxyz * bitMsk;
  return comp;
}
void main(void) {
  gl_FragColor = pack(viewDepth);
}
