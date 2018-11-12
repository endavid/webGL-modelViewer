(function(global) {
  "use strict";
  /**
    * Matrices are stored column-major, because this is the way they
    * need to be sent to the GPU.
    */
  var MATH = {
    degToRad: function(angle)
    {
      return(angle * Math.PI/180);
    },

    getProjection: function(angle, a, zMin, zMax)
    {
      var tan = Math.tan(MATH.degToRad(0.5*angle)),
        A = -(zMax + zMin)/(zMax - zMin),
        B = (-2*zMax*zMin)/(zMax-zMin);
      return [
        0.5/tan, 0, 0, 0,
        0, 0.5*a/tan, 0, 0,
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
      MATH.setI4(m);
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
      out[0+o] = ma[0] * mb[0] + ma[4] * mb[1] + ma[8] * mb[2] + ma[12] * mb[3];
      out[1+o] = ma[1] * mb[0] + ma[5] * mb[1] + ma[9] * mb[2] + ma[13] * mb[3];
      out[2+o] = ma[2] * mb[0] + ma[6] * mb[1] + ma[10] * mb[2] + ma[14] * mb[3];
      out[3+o] = ma[3] * mb[0] + ma[7] * mb[1] + ma[11] * mb[2] + ma[15] * mb[3];
      out[4+o] = ma[0] * mb[4] + ma[4] * mb[5] + ma[8] * mb[6] + ma[12] * mb[7];
      out[5+o] = ma[1] * mb[4] + ma[5] * mb[5] + ma[9] * mb[6] + ma[13] * mb[7];
      out[6+o] = ma[2] * mb[4] + ma[6] * mb[5] + ma[10] * mb[6] + ma[14] * mb[7];
      out[7+o] = ma[3] * mb[4] + ma[7] * mb[5] + ma[11] * mb[6] + ma[15] * mb[7];
      out[8+o] = ma[0] * mb[8] + ma[4] * mb[9] + ma[8] * mb[10] + ma[12] * mb[11];
      out[9+o] = ma[1] * mb[8] + ma[5] * mb[9] + ma[9] * mb[10] + ma[13] * mb[11];
      out[10+o] = ma[2] * mb[8] + ma[6] * mb[9] + ma[10] * mb[10] + ma[14] * mb[11];
      out[11+o] = ma[3] * mb[8] + ma[7] * mb[9] + ma[11] * mb[10] + ma[15] * mb[11];
      out[12+o] = ma[0] * mb[12] + ma[4] * mb[13] + ma[8] * mb[14] + ma[12] * mb[15];
      out[13+o] = ma[1] * mb[12] + ma[5] * mb[13] + ma[9] * mb[14] + ma[13] * mb[15];
      out[14+o] = ma[2] * mb[12] + ma[6] * mb[13] + ma[10] * mb[14] + ma[14] * mb[15];
      out[15+o] = ma[3] * mb[12] + ma[7] * mb[13] + ma[11] * mb[14] + ma[15] * mb[15];
      return out;
    },

    isPowerOf2: function(n) {
      if (typeof n !== 'number') {
        return null;
      }
      return n && (n & (n - 1)) === 0;
    }
  };
  // export
  global.MATH = (global.module || {}).exports = MATH;
})(this);
