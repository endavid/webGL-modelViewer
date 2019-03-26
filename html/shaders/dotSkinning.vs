attribute vec3 position;
attribute vec4 color;
attribute vec4 boneWeights;
attribute vec4 boneIndices;
const int BONE_COUNT = 100;
uniform mat4 joints[BONE_COUNT];
uniform mat4 Pmatrix;
uniform mat4 Vmatrix;
uniform mat4 Mmatrix;
varying vec4 vColor;
void main(void) { // pre-built function
  vec4 p = vec4(position, 1.);
  int i0 = int(boneIndices.x);
  int i1 = int(boneIndices.y);
  int i2 = int(boneIndices.z);
  int i3 = int(boneIndices.w);
  vec4 p0 = joints[i0] * p;
  vec4 p1 = joints[i1] * p;
  vec4 p2 = joints[i2] * p;
  vec4 p3 = joints[i3] * p;
  p = p0 * boneWeights.x + p1 * boneWeights.y + p2 * boneWeights.z + p3 * boneWeights.w;
  vec4 worldPos = Mmatrix * p;
  vec4 projected = Pmatrix * (Vmatrix * worldPos);
  gl_Position = projected;
  gl_PointSize = 3.0;
  vColor = color;
}
