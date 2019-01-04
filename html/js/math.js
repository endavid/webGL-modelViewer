/**
  * Matrices are stored column-major, because this is the way they
  * need to be sent to the GPU.
  */
var VMath = {
  normalize: function(v) {
    var norm = v.reduce((acc, c) => acc + c * c, 0);
    norm = Math.sqrt(norm) || 1;
    return v.map(c => c / norm);
  },
  
  degToRad: function(angle)
  {
    return(angle * Math.PI / 180.0);
  },

  radToDeg: function(angle)
  {
    return(angle * 180.0 / Math.PI);
  },

  getProjection: function(angle, a, zMin, zMax)
  {
    // ref https://github.com/endavid/VidEngine/blob/master/VidFramework/VidFramework/sdk/math/Matrix.swift
    const tan = Math.tan(VMath.degToRad(0.5*angle)),
      A = -(zMax + zMin)/(zMax - zMin),
      B = (-2*zMax*zMin)/(zMax-zMin);
    return [
      1.0/tan, 0, 0, 0,
      0, 1.0*a/tan, 0, 0,
      0, 0, A, -1,
      0, 0, B, 0
    ];
  },

  getI4: function() {
    return [1,0,0,0,
            0,1,0,0,
            0,0,1,0,
            0,0,0,1];
  },

  setI4: function(m, offset) {
    var o = offset || 0;
    m[o+0] =1; m[o+1] =0; m[o+2] =0; m[o+3] =0;
    m[o+4] =0; m[o+5] =1; m[o+6] =0; m[o+7] =0;
    m[o+8] =0; m[o+9] =0; m[o+10]=1; m[o+11]=0;
    m[o+12]=0; m[o+13]=0; m[o+14]=0; m[o+15]=1;
  },

  setScale4: function(m, scale) {
    VMath.setI4(m);
    m[0]=scale;
    m[5]=scale;
    m[10]=scale;
  },

  rotateX: function(m, angle) {
    var c=Math.cos(angle);
    var s=Math.sin(angle);
    var mv1=m[1], mv5=m[5], mv9=m[9];
    m[1]=m[1]*c-m[2]*s;
    m[5]=m[5]*c-m[6]*s;
    m[9]=m[9]*c-m[10]*s;

    m[2]=m[2]*c+mv1*s;
    m[6]=m[6]*c+mv5*s;
    m[10]=m[10]*c+mv9*s;
    return m;
  },

  rotateY: function(m, angle) {
    var c=Math.cos(angle);
    var s=Math.sin(angle);
    var mv0=m[0], mv4=m[4], mv8=m[8];
    m[0]=c*m[0]+s*m[2];
    m[4]=c*m[4]+s*m[6];
    m[8]=c*m[8]+s*m[10];

    m[2]=c*m[2]-s*mv0;
    m[6]=c*m[6]-s*mv4;
    m[10]=c*m[10]-s*mv8;
    return m;
  },

  rotateZ: function(m, angle) {
    var c=Math.cos(angle);
    var s=Math.sin(angle);
    var mv0=m[0], mv4=m[4], mv8=m[8];
    m[0]=c*m[0]-s*m[1];
    m[4]=c*m[4]-s*m[5];
    m[8]=c*m[8]-s*m[9];

    m[1]=c*m[1]+s*mv0;
    m[5]=c*m[5]+s*mv4;
    m[9]=c*m[9]+s*mv8;
    return m;
  },

  translateX: function(m, t){
    m[12]+=t;
  },

  translateY: function(m, t){
    m[13]+=t;
  },

  translateZ: function(m, t){
    m[14]+=t;
  },

  mulVector: function(m, v) {
    var out = [0,0,0,0];
    // for row-major matrices
    out[0] = m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12] * v[3];
    out[1] = m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13] * v[3];
    out[2] = m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14] * v[3];
    out[3] = m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15] * v[3];
    return out;
  },

  transpose: function(mi, m, offset) {
    var out = m || new Array(16);
    var o = offset || 0;
    out[0+o] = mi[0];
    out[1+o] = mi[4];
    out[2+o] = mi[8];
    out[3+o] = mi[12];
    out[4+o] = mi[1];
    out[5+o] = mi[5];
    out[6+o] = mi[9];
    out[7+o] = mi[13];
    out[8+o] = mi[2];
    out[9+o] = mi[6];
    out[10+o] = mi[10];
    out[11+o] = mi[14];
    out[12+o] = mi[3];
    out[13+o] = mi[7];
    out[14+o] = mi[11];
    out[15+o] = mi[15];
    return out;
  },

  mulMatrix: function(ma, mb, m, offset) {
    var out = m || new Array(16);
    var o = offset || 0;
    // for row-major matrices
    out[0+o]  = mb[0] * ma[0]  + mb[4] * ma[1]  + mb[8]  * ma[2]  + mb[12] * ma[3];
    out[1+o]  = mb[1] * ma[0]  + mb[5] * ma[1]  + mb[9]  * ma[2]  + mb[13] * ma[3];
    out[2+o]  = mb[2] * ma[0]  + mb[6] * ma[1]  + mb[10] * ma[2]  + mb[14] * ma[3];
    out[3+o]  = mb[3] * ma[0]  + mb[7] * ma[1]  + mb[11] * ma[2]  + mb[15] * ma[3];
    out[4+o]  = mb[0] * ma[4]  + mb[4] * ma[5]  + mb[8]  * ma[6]  + mb[12] * ma[7];
    out[5+o]  = mb[1] * ma[4]  + mb[5] * ma[5]  + mb[9]  * ma[6]  + mb[13] * ma[7];
    out[6+o]  = mb[2] * ma[4]  + mb[6] * ma[5]  + mb[10] * ma[6]  + mb[14] * ma[7];
    out[7+o]  = mb[3] * ma[4]  + mb[7] * ma[5]  + mb[11] * ma[6]  + mb[15] * ma[7];
    out[8+o]  = mb[0] * ma[8]  + mb[4] * ma[9]  + mb[8]  * ma[10] + mb[12] * ma[11];
    out[9+o]  = mb[1] * ma[8]  + mb[5] * ma[9]  + mb[9]  * ma[10] + mb[13] * ma[11];
    out[10+o] = mb[2] * ma[8]  + mb[6] * ma[9]  + mb[10] * ma[10] + mb[14] * ma[11];
    out[11+o] = mb[3] * ma[8]  + mb[7] * ma[9]  + mb[11] * ma[10] + mb[15] * ma[11];
    out[12+o] = mb[0] * ma[12] + mb[4] * ma[13] + mb[8]  * ma[14] + mb[12] * ma[15];
    out[13+o] = mb[1] * ma[12] + mb[5] * ma[13] + mb[9]  * ma[14] + mb[13] * ma[15];
    out[14+o] = mb[2] * ma[12] + mb[6] * ma[13] + mb[10] * ma[14] + mb[14] * ma[15];
    out[15+o] = mb[3] * ma[12] + mb[7] * ma[13] + mb[11] * ma[14] + mb[15] * ma[15];
    return out;
  },

  sum: (a, b) => {
    var out = [];
    a.forEach((v, i) => {
      out.push(v + b[i]);
    });
    return out;
  },

  diff: (a, b) => {
    var out = [];
    a.forEach((v, i) => {
      out.push(v - b[i]);
    });
    return out;
  },

  cross: (a, b) => {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ];
  },

  isPowerOf2: function(n) {
    if (typeof n !== 'number') {
      return null;
    }
    return n && (n & (n - 1)) === 0;
  },

  rgbToFloat: function(rgb) {
    var r = (rgb >> 16) & 0x0000ff;
    var g = (rgb >> 8) & 0x0000ff;
    var b = (rgb) & 0x0000ff;
    return [r / 255.0, g / 255.0, b / 255.0];
  },

  clampAngle: function(a) {
    while (a < -Math.PI) a += Math.PI * 2;
    while (a > Math.PI) a -= Math.PI * 2;
    return a;
  },

  clamp: function(a, minA, maxA) {
    if (a < minA) return minA;
    if (a > maxA) return maxA;
    return a;
  }
};
export {VMath as default};
