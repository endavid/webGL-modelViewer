precision mediump float;
uniform sampler2D sampler;
uniform vec3 lightDirection;
varying vec2 vUV;
varying vec3 vNormal;
varying vec3 worldPosition;
varying vec3 cameraPosition;
void main(void) {
  // some random range atm, camera ~3 meters
  float z = 0.25 * gl_FragCoord.z / gl_FragCoord.w - 0.5;
  gl_FragColor = vec4(z, z, z, 1.0);
}
