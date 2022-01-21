// BONE_COUNT needs to be set dynamically when loading the shader
// const int BONE_COUNT = 100;
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
attribute vec4 color;
attribute float objectId;
attribute vec4 boneWeights;
// @todo update to webgl2 that supports ivec4
attribute vec4 boneIndices;
uniform mat4 joints[BONE_COUNT];
uniform vec4 jointDebugPalette[BONE_COUNT];
uniform mat4 Pmatrix;
uniform mat4 Vmatrix;
uniform mat4 Mmatrix;
varying vec2 vUV;
varying vec3 vNormal;
varying vec3 cameraPosition;
varying vec3 worldPosition;
varying highp float viewDepth;
varying vec4 debugBoneWeightColor;
varying vec4 debugBoneCount;
varying vec4 vertexColor;
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
  worldPosition = worldPos.xyz;
  vec4 projected = Pmatrix * (Vmatrix * worldPos);
  gl_Position = projected;
  // normalized view depth
  viewDepth = projected.z / projected.w;
  vec4 n = vec4(normal, 0.);
  vec4 n0 = joints[i0] * n;
  vec4 n1 = joints[i1] * n;
  vec4 n2 = joints[i2] * n;
  vec4 n3 = joints[i3] * n;
  n = n0 * boneWeights.x + n1 * boneWeights.y + n2 * boneWeights.z + n3 * boneWeights.w;
  vNormal = normalize(vec3(Mmatrix * n));
  vUV = uv;
  vec4 camTranslation = Vmatrix * vec4(0,0,0,1);
  cameraPosition = -camTranslation.xyz;
  // for debugging skinning weights
  vec4 jointColor0 = jointDebugPalette[i0];
  vec4 jointColor1 = jointDebugPalette[i1];
  vec4 jointColor2 = jointDebugPalette[i2];
  vec4 jointColor3 = jointDebugPalette[i3];
  debugBoneWeightColor = jointColor0 * boneWeights.x + jointColor1 * boneWeights.y + jointColor2 * boneWeights.z + jointColor3 * boneWeights.w;
  debugBoneWeightColor.a = 1.0;
  // for debugging bone count
  int count = int(objectId);
  debugBoneCount = jointDebugPalette[count];
  vertexColor = color;
}
