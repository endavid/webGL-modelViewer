import VMath from './math.js';
import AngleAxis from './angleAxis.js';

class Quaternion {
  constructor(w, v) {
    this.w = w; // 1D
    this.v = v; // 3D
  }
  static fromAngleAxis(aa) {
    const a = aa.angle;
    const w = Math.cos(0.5 * a);
    const v = VMath.mulScalar(aa.axis, Math.sin(0.5 * a));
    return new Quaternion(w, v);
  }
  toAngleAxis(rotationOrder) {
    const norm = Math.sqrt(VMath.dot(this.v, this.v));
    const axis = VMath.isClose(norm, 0) ? [0, 0, 1] : VMath.divScalar(this.v, norm);
    const theta = 2.0 * Math.atan2(norm, this.w);
    return new AngleAxis(theta, axis, rotationOrder);
  }
}

export { Quaternion as default };