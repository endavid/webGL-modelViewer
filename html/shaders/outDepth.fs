precision mediump float;
uniform sampler2D sampler;
uniform vec3 lightDirection;
uniform vec4 lightIrradiance;
varying vec2 vUV;
varying vec3 vNormal;
varying vec3 worldPosition;
varying vec3 cameraPosition;
varying highp float viewDepth;
void main(void) {
  gl_FragColor = vec4(viewDepth, 0, 0, lightIrradiance.a);
}
