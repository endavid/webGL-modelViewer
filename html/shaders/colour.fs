precision mediump float;
uniform sampler2D texColour;
varying vec2 vUV;
uniform mat4 colourTransform;
uniform vec4 colourBias;
void main(void) {
  vec4 colour = texture2D(texColour, vUV);
  gl_FragColor = colour * colourTransform + colourBias;
}
