precision mediump float;
uniform sampler2D sampler;
uniform vec3 lightDirection;
varying vec2 vUV;
varying vec3 vNormal;
varying vec3 worldPosition;
varying vec3 cameraPosition;
varying vec4 debugBoneWeightColor;
void main(void) {
  gl_FragColor = debugBoneWeightColor;
}
