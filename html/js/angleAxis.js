import VMath from './math.js';

function toMatrix(angle, axis) {
  // http://www.euclideanspace.com/maths/geometry/rotations/conversions/angleToMatrix/index.htm
  // https://en.wikipedia.org/wiki/Rotation_matrix#Rotation_matrix_from_axis_and_angle
  const [ux, uy, uz] = axis;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const t = 1 - cos;
  const m = [
    cos + ux*ux*t,    uy*ux*t - uz*sin, uz*ux*t + uy*sin,
    uy*ux*t + uz*sin, cos + uy*uy*t,    uz*uy*t - ux*sin,
    uz*ux*t - uy*sin, uz*uy*t + ux*sin, cos + uz*uz*t
  ];
  return m;
}

function toEuler(rotationMatrix, rotationOrder) {
  // Ref. https://github.com/mrdoob/three.js/blob/dev/src/math/Euler.js
  // For tests: https://www.andre-gaschler.com/rotationconverter/
  let [x, y, z] = [0, 0, 0];
  const epsilon = 1e-6;
  const [r00, r01, r02, r10, r11, r12, r20, r21, r22] = rotationMatrix;
  switch (rotationOrder) {
  case 'xyz':
    y = Math.asin(r02);
    if (Math.abs(r02) < 1 - epsilon) {
      x = Math.atan2(-r12, r22);
      z = Math.atan2(-r01, r00);
    } else {
      x = Math.atan2(r21, r11);
      z = 0;
    }
    break;
  case 'yxz':
    x = Math.asin(-r12);
    if (Math.abs(r12) < 1 - epsilon) {
      y = Math.atan2(r02, r22);
      z = Math.atan2(r10, r11);
    } else {
      y = Math.atan2(-r20, r00);
      z = 0;
    }
    break;
  case 'zxy':
    x = Math.asin(r21);
    if (Math.abs(r21) < 1 - epsilon) {
      y = Math.atan2(-r20, r22);
      z = Math.atan2(-r01, r11);
    } else {
      y = 0;
      z = Math.atan2(r10, r00);
    }
    break;
  case 'zyx':
    y = Math.asin(-r20);
    if (Math.abs(r20) < 1 - epsilon) {
      x = Math.atan2(r21, r22);
      z = Math.atan2(r10, r00);
    } else {
      x = 0;
      z = Math.atan2(-r01, r11);
    }
    break;
  case 'yzx':
    z = Math.asin(r10);
    if (Math.abs(r10) < 1 - epsilon) {
      x = Math.atan2(-r12, r11);
      y = Math.atan2(-r20, r00);
    } else {
      x = 0;
      y = Math.atan2(r02, r22);
    }
    break;
  case 'xzy':
    z = Math.asin(-r01);
    if (Math.abs(r01) < 1 - epsilon) {
      x = Math.atan2(r21, r11);
      y = Math.atan2(r02, r00);
    } else {
      x = Math.atan2(-r12, r22);
      y = 0;
    }
    break;
  default:
    throw `Invalid rotation order: ${rotationOrder}`;
  }
  return [x, y, z];
}

class AngleAxis {
  constructor(angle, axis, rotationOrder) {
    this.angle = angle;
    this.axis = axis;
    this.rotationOrder = rotationOrder;
    this.rotationMatrix = toMatrix(angle, axis);
    this.eulerAngles = toEuler(this.rotationMatrix, rotationOrder);
  }
  static fromMatrix(R, rotationOrder) {
    const angle = Math.acos((R[0][0] + R[1][1] + R[2][2] - 1.0) / 2.0);
    let rx = 0.0;
    let ry = 0.0;
    let rz = 1.0;
    if (!VMath.isClose(angle, 0)) {
      const dx = R[2][1] - R[1][2];
      const dy = R[0][2] - R[2][0];
      const dz = R[1][0] - R[0][1];
      const dd = Math.hypot(dx, dy, dz);
      if (!VMath.isClose(dd, 0)) {
        rx = (R[2][1] - R[1][2]) / dd;
        ry = (R[0][2] - R[2][0]) / dd;
        rz = (R[1][0] - R[0][1]) / dd;
      }
    }
    const axis = [rx, ry, rz ];
    const aa = new AngleAxis(angle, axis, rotationOrder);
    return aa;
  }
};

export { AngleAxis as default };