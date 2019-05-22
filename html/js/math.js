const { math } = window;

/* eslint-disable no-param-reassign */
/* eslint-disable prefer-destructuring */
/**
  * Matrices are stored column-major, because this is the way they
  * need to be sent to the GPU.
  */
const VMath = {
  isClose(a, b, epsilon) {
    const e = epsilon || 1e-6;
    return Math.abs(a - b) < e;
  },

  round(vector, numDigits) {
    const p = numDigits || 6;
    const c = 10 ** p;
    return vector.map(a => Math.round(a * c) / c);
  },

  // checks for 2 possible formats, {x: 0, y: 0, z: 0}
  // and [0, 0, 0], and returns a vector of 4 ending in 1, [0, 0, 0, 1]
  readCoordinates(pos) {
    if (pos.x !== undefined) {
      return [pos.x, pos.y, pos.z, 1];
    }
    return [pos[0], pos[1], pos[2], 1];
  },

  length(v) {
    const norm = v.reduce((acc, c) => acc + c * c, 0);
    return Math.sqrt(norm);
  },
  normalize(v) {
    const norm = VMath.length(v) || 1;
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

  // Rx http://www.songho.ca/opengl/gl_anglestoaxes.html
  // Also, math.js expects matrices in row-major order
  rotationMatrixAroundX(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const m = [
      [1, 0, 0],
      [0, c, -s],
      [0, s, c],
    ];
    return m;
  },
  rotationMatrixAroundY(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const m = [
      [c, 0, s],
      [0, 1, 0],
      [-s, 0, c],
    ];
    return m;
  },
  rotationMatrixAroundZ(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const m = [
      [c, -s, 0],
      [s, c, 0],
      [0, 0, 1],
    ];
    return m;
  },
  rotationMatrixFromEuler(angles, rotationOrder) {
    const ro = rotationOrder;
    const Rs = {
      x: VMath.rotationMatrixAroundX(angles[0]),
      y: VMath.rotationMatrixAroundY(angles[1]),
      z: VMath.rotationMatrixAroundZ(angles[2]),
    };
    const R = math.multiply(Rs[ro[0]], math.multiply(Rs[ro[1]], Rs[ro[2]]));
    return R;
  },
  scaleMatrix(s) {
    return [
      [s[0], 0, 0],
      [0, s[1], 0],
      [0, 0, s[2]],
    ];
  },

  angleAxisFromRotationMatrix(R) {
    const angle = Math.acos((R[0][0] + R[1][1] + R[2][2] - 1) / 2);
    let axis = [0, 0, 1];
    if (!VMath.isClose(angle, 0)) {
      const d = [
        R[1][2] - R[2][1],
        R[2][0] - R[0][2],
        R[0][1] - R[1][0],
      ];
      const dd = VMath.length(d);
      if (!VMath.isClose(dd, 0)) {
        axis = VMath.normalize(d);
      }
    }
    return { angle, axis };
  },

  eulerAnglesFromAngleAxis(angleAxis, rotationOrder) {
    // http://www.euclideanspace.com/maths/geometry/rotations/conversions/angleToEuler/index.htm
    const { angle, axis } = angleAxis;
    const p = { x: axis[0], y: axis[1], z: axis[2] };
    // 'xyz', 'yzx', ...
    const a = rotationOrder[0];
    const b = rotationOrder[1];
    const c = rotationOrder[2];
    let x = p[a];
    const y = p[c];
    const z = p[b];
    if (rotationOrder === 'xzy' || rotationOrder === 'yxz' || rotationOrder === 'zyx') {
      x = -x;
    }
    const sa = Math.sin(angle);
    const t = 1 - Math.cos(angle);
    const epsilon = 1e-6;
    let v = { x: 0, y: 0, z: 0 };
    if (1.0 - x * y * t + z * sa < epsilon) {
      // north pole singularity
      v = {
        x: 2 * Math.atan2(x * Math.sin(angle / 2), Math.cos(angle / 2)),
        y: Math.PI / 2,
        z: 0,
      };
    } else if (1.0 + x * y * t + z * sa < epsilon) {
      // south pole singularity
      v = {
        x: -2 * Math.atan2(x * Math.sin(angle / 2), Math.cos(angle / 2)),
        y: -Math.PI / 2,
        z: 0,
      };
    } else {
      v = {
        x: Math.atan2(y * sa - x * z * t, 1 - (y * y + z * z) * t),
        y: Math.asin(x * y * t + z * sa),
        z: Math.atan2(x * sa - y * z * t, 1 - (x * x + z * z) * t),
      };
    }
    switch (rotationOrder) {
      case 'xzy':
        return [-v[b], v[a], v[c]];
      case 'yxz':
        return [v[a], -v[c], v[b]];
      case 'zyx':
        return [v[c], v[b], -v[a]];
      default:
        return [v[c], v[b], v[a]];
    }
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
  clampAngleDeg: (a) => {
    while (a < -180) a += 360;
    while (a > 180) a -= 360;
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
