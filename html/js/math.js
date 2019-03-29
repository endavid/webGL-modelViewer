/* eslint-disable no-param-reassign */
/* eslint-disable prefer-destructuring */
/**
  * Matrices are stored column-major, because this is the way they
  * need to be sent to the GPU.
  */
const VMath = {
  // checks for 2 possible formats, {x: 0, y: 0, z: 0}
  // and [0, 0, 0], and returns a vector of 4 ending in 1, [0, 0, 0, 1]
  readCoordinates(pos) {
    if (pos.x !== undefined) {
      return [pos.x, pos.y, pos.z, 1];
    }
    return [pos[0], pos[1], pos[2], 1];
  },

  normalize(v) {
    let norm = v.reduce((acc, c) => acc + c * c, 0);
    norm = Math.sqrt(norm) || 1;
    return v.map(c => c / norm);
  },

  mulScalar(v, s) {
    return v.map(a => s * a);
  },

  degToRad: angle => (angle * Math.PI / 180.0),

  radToDeg: angle => angle * 180.0 / Math.PI,

  getProjection(angle, a, zMin, zMax) {
    // ref https://github.com/endavid/VidEngine/blob/master/VidFramework/VidFramework/sdk/math/Matrix.swift
    const tan = Math.tan(VMath.degToRad(0.5 * angle));
    const A = -(zMax + zMin) / (zMax - zMin);
    const B = (-2 * zMax * zMin) / (zMax - zMin);
    return [
      1.0 / tan, 0, 0, 0,
      0, 1.0 * a / tan, 0, 0,
      0, 0, A, -1,
      0, 0, B, 0];
  },

  getProjectionInverse(angle, a, zMin, zMax) {
    // ref https://github.com/endavid/VidEngine/blob/master/VidFramework/VidFramework/sdk/math/Matrix.swift
    // just work out the maths, substituting params in FrustumInverse
    const tan = Math.tan(VMath.degToRad(0.5 * angle));
    const A = (zMin - zMax) / (2 * zMin * zMax);
    const B = (zMin + zMax) / (2 * zMin * zMax);
    return [
      tan, 0, 0, 0,
      0, tan / a, 0, 0,
      0, 0, 0, A,
      0, 0, -1, B];
  },

  getI4: () => [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1],

  setI4: (m, offset) => {
    const o = offset || 0;
    m[o + 0] = 1; m[o + 1] = 0; m[o + 2] = 0; m[o + 3] = 0;
    m[o + 4] = 0; m[o + 5] = 1; m[o + 6] = 0; m[o + 7] = 0;
    m[o + 8] = 0; m[o + 9] = 0; m[o + 10] = 1; m[o + 11] = 0;
    m[o + 12] = 0; m[o + 13] = 0; m[o + 14] = 0; m[o + 15] = 1;
  },

  setScale4: (m, scale) => {
    VMath.setI4(m);
    m[0] = scale;
    m[5] = scale;
    m[10] = scale;
  },

  rotateX: (m, angle) => {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const mv1 = m[1];
    const mv5 = m[5];
    const mv9 = m[9];
    m[1] = m[1] * c - m[2] * s;
    m[5] = m[5] * c - m[6] * s;
    m[9] = m[9] * c - m[10] * s;
    m[2] = m[2] * c + mv1 * s;
    m[6] = m[6] * c + mv5 * s;
    m[10] = m[10] * c + mv9 * s;
    return m;
  },

  rotateY: (m, angle) => {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const mv0 = m[0];
    const mv4 = m[4];
    const mv8 = m[8];
    m[0] = c * m[0] + s * m[2];
    m[4] = c * m[4] + s * m[6];
    m[8] = c * m[8] + s * m[10];
    m[2] = c * m[2] - s * mv0;
    m[6] = c * m[6] - s * mv4;
    m[10] = c * m[10] - s * mv8;
    return m;
  },

  rotateZ: (m, angle) => {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const mv0 = m[0];
    const mv4 = m[4];
    const mv8 = m[8];
    m[0] = c * m[0] - s * m[1];
    m[4] = c * m[4] - s * m[5];
    m[8] = c * m[8] - s * m[9];
    m[1] = c * m[1] + s * mv0;
    m[5] = c * m[5] + s * mv4;
    m[9] = c * m[9] + s * mv8;
    return m;
  },

  setTranslation(m, position) {
    m[12] = position[0];
    m[13] = position[1];
    m[14] = position[2];
  },

  mulVector(m, v) {
    const out = [0, 0, 0, 0];
    // for row-major matrices
    out[0] = m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12] * v[3];
    out[1] = m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13] * v[3];
    out[2] = m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14] * v[3];
    out[3] = m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15] * v[3];
    return out;
  },

  mulColumnVector(m, v) {
    const out = [0, 0, 0, 0];
    // for column-major matrices
    out[0] = m[0] * v[0] + m[1] * v[1] + m[2] * v[2] + m[3] * v[3];
    out[1] = m[4] * v[0] + m[5] * v[1] + m[6] * v[2] + m[7] * v[3];
    out[2] = m[8] * v[0] + m[9] * v[1] + m[10] * v[2] + m[11] * v[3];
    out[3] = m[12] * v[0] + m[13] * v[1] + m[14] * v[2] + m[15] * v[3];
    return out;
  },

  transpose: (mi, m, offset) => {
    const out = m || new Array(16);
    const o = offset || 0;
    out[0 + o] = mi[0];
    out[1 + o] = mi[4];
    out[2 + o] = mi[8];
    out[3 + o] = mi[12];
    out[4 + o] = mi[1];
    out[5 + o] = mi[5];
    out[6 + o] = mi[9];
    out[7 + o] = mi[13];
    out[8 + o] = mi[2];
    out[9 + o] = mi[6];
    out[10 + o] = mi[10];
    out[11 + o] = mi[14];
    out[12 + o] = mi[3];
    out[13 + o] = mi[7];
    out[14 + o] = mi[11];
    out[15 + o] = mi[15];
    return out;
  },

  mulMatrix: (ma, mb, m, offset) => {
    const out = m || new Array(16);
    const o = offset || 0;
    // for row-major matrices
    out[0 + o] = mb[0] * ma[0] + mb[4] * ma[1] + mb[8] * ma[2] + mb[12] * ma[3];
    out[1 + o] = mb[1] * ma[0] + mb[5] * ma[1] + mb[9] * ma[2] + mb[13] * ma[3];
    out[2 + o] = mb[2] * ma[0] + mb[6] * ma[1] + mb[10] * ma[2] + mb[14] * ma[3];
    out[3 + o] = mb[3] * ma[0] + mb[7] * ma[1] + mb[11] * ma[2] + mb[15] * ma[3];
    out[4 + o] = mb[0] * ma[4] + mb[4] * ma[5] + mb[8] * ma[6] + mb[12] * ma[7];
    out[5 + o] = mb[1] * ma[4] + mb[5] * ma[5] + mb[9] * ma[6] + mb[13] * ma[7];
    out[6 + o] = mb[2] * ma[4] + mb[6] * ma[5] + mb[10] * ma[6] + mb[14] * ma[7];
    out[7 + o] = mb[3] * ma[4] + mb[7] * ma[5] + mb[11] * ma[6] + mb[15] * ma[7];
    out[8 + o] = mb[0] * ma[8] + mb[4] * ma[9] + mb[8] * ma[10] + mb[12] * ma[11];
    out[9 + o] = mb[1] * ma[8] + mb[5] * ma[9] + mb[9] * ma[10] + mb[13] * ma[11];
    out[10 + o] = mb[2] * ma[8] + mb[6] * ma[9] + mb[10] * ma[10] + mb[14] * ma[11];
    out[11 + o] = mb[3] * ma[8] + mb[7] * ma[9] + mb[11] * ma[10] + mb[15] * ma[11];
    out[12 + o] = mb[0] * ma[12] + mb[4] * ma[13] + mb[8] * ma[14] + mb[12] * ma[15];
    out[13 + o] = mb[1] * ma[12] + mb[5] * ma[13] + mb[9] * ma[14] + mb[13] * ma[15];
    out[14 + o] = mb[2] * ma[12] + mb[6] * ma[13] + mb[10] * ma[14] + mb[14] * ma[15];
    out[15 + o] = mb[3] * ma[12] + mb[7] * ma[13] + mb[11] * ma[14] + mb[15] * ma[15];
    return out;
  },

  sum(a, b) {
    const out = [];
    a.forEach((v, i) => {
      out.push(v + b[i]);
    });
    return out;
  },
  diff(a, b) {
    const out = [];
    a.forEach((v, i) => {
      out.push(v - b[i]);
    });
    return out;
  },
  dot(a, b) {
    let s = 0;
    a.forEach((c, i) => { s += c * b[i]; });
    return s;
  },
  distance(a, b) {
    const ab = VMath.diff(a, b);
    return Math.sqrt(VMath.dot(ab, ab));
  },
  cross: (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]],

  isPowerOf2(n) {
    if (typeof n !== 'number') {
      return null;
    }
    // eslint-disable-next-line no-bitwise
    return n && (n & (n - 1)) === 0;
  },

  rgbToFloat: (rgb) => {
    /* eslint-disable no-bitwise */
    const r = (rgb >> 16) & 0x0000ff;
    const g = (rgb >> 8) & 0x0000ff;
    const b = (rgb) & 0x0000ff;
    /* eslint-enable no-bitwise */
    return [r / 255.0, g / 255.0, b / 255.0];
  },

  clampAngle: (a) => {
    while (a < -Math.PI) a += Math.PI * 2;
    while (a > Math.PI) a -= Math.PI * 2;
    return a;
  },

  clamp: (a, minA, maxA) => {
    if (a < minA) return minA;
    if (a > maxA) return maxA;
    return a;
  },

  vectorToHexColor: (v) => {
    // can't use 'map' because it returns another Float32Array...
    let c = [];
    v.forEach(a => c.push(Math.round(255 * a).toString(16)));
    c = c.map((a) => {
      if (a.length === 1) return `0${a}`;
      return a;
    });
    return `#${c.join('')}`;
  },

  hexColorToNormalizedVector: (color) => {
    // e.g. #120e14
    let v = [
      color.slice(1, 3),
      color.slice(3, 5),
      color.slice(5, 7),
    ];
    v = v.map(a => parseInt(a, 16) / 255);
    return v;
  },

  travelDistance(ray, distance) {
    const m = ray.direction.map(a => distance * a);
    return VMath.sum(ray.start, m);
  },
};
export { VMath as default };
