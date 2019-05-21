import VMath from './math.js';

// Unfortunately, I wasn't able to import math.js as a module
const { math } = window;

class Transform {
  constructor({ position, scale, eulerAngles }) {
    this.position = position || [0, 0, 0];
    this.scale = scale || [1, 1, 1];
    // ZYX rotation order (X applied first), stored in degrees
    this.eulerAngles = eulerAngles || [0, 0, 0];
    this.rotationOrder = 'zyx';
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
  toColumnMajorArray() {
    const M = math.transpose(this.toMatrix());
    return [].concat(...M);
  }
}

export default Transform;
