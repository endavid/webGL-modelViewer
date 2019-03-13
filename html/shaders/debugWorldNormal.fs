precision mediump float;
uniform sampler2D sampler;
uniform vec3 lightDirection;
varying vec2 vUV;
varying vec3 vNormal;
varying vec3 worldPosition;
varying vec3 cameraPosition;
void main(void) {
  gl_FragColor = vec4(0.5 * vNormal + 0.5, 1.0);
}