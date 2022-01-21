precision mediump float;
uniform sampler2D sampler;
uniform vec3 lightDirection;
uniform vec4 lightIrradiance;
varying vec2 vUV;
varying vec3 vNormal;
varying vec3 worldPosition;
varying vec3 cameraPosition;
varying vec4 vertexColor;
void main(void) {
  vec4 lines = 1.0 / clamp(64.0 * vertexColor, 0.0001, 64.0);
  float line = max(lines.r, max(lines.g, lines.b));
  gl_FragColor = vec4(line, line, line, 1.0);
  //gl_FragColor.rgb = lines.rgb;
  //gl_FragColor = vec4(vertexColor.aaa, 1.0);
  //gl_FragColor = vec4(vertexColor.rgb, 1.0);
}
