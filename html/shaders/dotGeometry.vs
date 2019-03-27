attribute vec3 position;
attribute vec4 color;
uniform mat4 Pmatrix;
uniform mat4 Vmatrix;
uniform mat4 Mmatrix;
uniform float pointSize;
varying vec4 vColor;
void main(void) { // pre-built function
  vec4 worldPos = Mmatrix * vec4(position, 1.);
  vec4 projected = Pmatrix * (Vmatrix * worldPos);
  gl_Position = projected;
  gl_PointSize = pointSize;
  vColor = color;
}
