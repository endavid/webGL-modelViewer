/* eslint-disable object-curly-newline */
import VMath from './math.js';

// Unfortunately, I wasn't able to import math.js as a module
const { math } = window;

function multiply(M, point) {
  const v = point.slice(0, 3);
  v[3] = 1;
  const p = math.multiply(M, v);
  return p.slice(0, 3);
}

class Transform {
  constructor({ position, scale, eulerAngles, rotationOrder }) {
    this.position = position || [0, 0, 0];
    this.scale = scale || [1, 1, 1];
    // ZYX rotation order (X applied first), stored in degrees
    this.eulerAngles = eulerAngles || [0, 0, 0];
    this.rotationOrder = rotationOrder || 'zyx';
  }
  static fromMatrix(M, rotationOrder) {
    // ref. https://math.stackexchange.com/a/1463487
    // ref. https://github.com/endavid/VidEngine/blob/master/VidFramework/VidFramework/sdk/math/Transform.swift
    const position = [M[0][3], M[1][3], M[2][3]];
    const RS = math.resize(M, [3, 3]);
    const RSt = math.transpose(RS);
    // only works if there's no shear (isotropic scale)
    const scale = RSt.map(column => VMath.length(column));
    const Rt = RSt.map((col, i) => math.divide(col, scale[i]));
    const R = math.transpose(Rt);
    const angles = VMath.eulerAnglesFromRotationMatrix(R, rotationOrder);
    const eulerAngles = angles.map(VMath.radToDeg);
    return new Transform({ position, scale, eulerAngles, rotationOrder });
  }
  static fromRowMajorArray(array, rotationOrder) {
    const M = math.reshape(array, [4, 4]);
    return Transform.fromMatrix(M, rotationOrder);
  }
  static identity() {
    return new Transform({});
  }
  toMatrix() {
    const angles = this.eulerAngles.map(a => VMath.degToRad(a));
    const R = VMath.rotationMatrixFromEuler(angles, this.rotationOrder);
    const RS = math.multiply(R, VMath.scaleMatrix(this.scale));
    const M = math.resize(RS, [4, 4]);
    /* eslint-disable prefer-destructuring */
    M[0][3] = this.position[0];
    M[1][3] = this.position[1];
    M[2][3] = this.position[2];
    M[3][3] = 1;
    /* eslint-enable prefer-destructuring */
    return M;
  }
  toRowMajorArray() {
    const M = this.toMatrix();
    return [].concat(...M);
  }
  toColumnMajorArray() {
    const M = math.transpose(this.toMatrix());
    return [].concat(...M);
  }
  transformPoint(point) {
    return multiply(this.toMatrix(), point);
  }
  inversePoint(point) {
    return multiply(math.inv(this.toMatrix()), point);
  }
}

export default Transform;
