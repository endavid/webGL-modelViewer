precision mediump float;
uniform sampler2D sampler;
uniform vec3 lightDirection;
uniform vec3 lightIrradiance;
varying vec2 vUV;
varying vec3 vNormal;
varying vec3 worldPosition;
varying vec3 cameraPosition;
void main(void) {
  gl_FragColor = vec4(lightIrradiance, 1.0);
}
