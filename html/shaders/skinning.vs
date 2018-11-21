attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
attribute vec4 boneWeights;
attribute vec4 boneIndices;
const int BONE_COUNT = 100;
uniform mat4 joints[BONE_COUNT];
uniform mat4 Pmatrix;
uniform mat4 Vmatrix;
uniform mat4 Mmatrix;
varying vec2 vUV;
varying vec3 vNormal;
varying vec3 cameraPosition;
varying vec3 worldPosition;
void main(void) { // pre-built function
  vec4 p = vec4(position, 1.);
  vec4 p0 = joints[int(boneIndices.x)] * p;
  vec4 p1 = joints[int(boneIndices.y)] * p;
  vec4 p2 = joints[int(boneIndices.z)] * p;
  vec4 p3 = joints[int(boneIndices.w)] * p;
  p = p0 * boneWeights.x + p1 * boneWeights.y + p2 * boneWeights.z + p3 * boneWeights.w;
  vec4 worldPos = Mmatrix * p;
  worldPosition = worldPos.xyz;
  gl_Position = Pmatrix * Vmatrix * worldPos;
  vec4 n = vec4(normal, 0.);
  vec4 n0 = joints[int(boneIndices.x)] * n;
  vec4 n1 = joints[int(boneIndices.y)] * n;
  vec4 n2 = joints[int(boneIndices.z)] * n;
  vec4 n3 = joints[int(boneIndices.w)] * n;
  n = n0 * boneWeights.x + n1 * boneWeights.y + n2 * boneWeights.z + n3 * boneWeights.w;
  vNormal = normalize(vec3(Mmatrix * n));
  vUV = uv;
  vec4 camTranslation = Vmatrix * vec4(0,0,0,1);
  cameraPosition = -camTranslation.xyz;
}
