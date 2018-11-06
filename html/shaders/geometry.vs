attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
uniform mat4 Pmatrix;
uniform mat4 Vmatrix;
uniform mat4 Mmatrix;
varying vec2 vUV;
varying vec3 vNormal;
varying vec3 cameraPosition;
varying vec3 worldPosition;
void main(void) { // pre-built function
  vec4 worldPos = Mmatrix * vec4(position, 1.);
	worldPosition = worldPos.xyz;
	gl_Position = Pmatrix * Vmatrix * worldPos;
	vNormal = normalize(vec3(Mmatrix * vec4(normal, 0.)));
	vUV = uv;
	vec4 camTranslation = Vmatrix * vec4(0,0,0,1);
	cameraPosition = -camTranslation.xyz;
}
