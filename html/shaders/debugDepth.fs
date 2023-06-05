precision mediump float;
uniform sampler2D sampler;
uniform vec3 lightDirection;
uniform vec4 lightIrradiance;
varying vec2 vUV;
varying vec3 vNormal;
varying vec3 worldPosition;
varying vec3 cameraPosition;
void main(void) {
  float depthSlope = lightIrradiance.z;
  float depthOffset = lightIrradiance.w;
  float z = depthSlope * gl_FragCoord.z / gl_FragCoord.w + depthOffset;
  gl_FragColor = vec4(z, z, z, 1.0);
}
