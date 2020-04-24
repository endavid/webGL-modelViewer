import VMath from './math.js';
import Transform from './transform.js';

// Unfortunately, I wasn't able to import math.js as a module
const { math } = window;

function valueOrDefault(v, d) {
  return (v == null) ? d : v;
}

class Camera {
  constructor(fov, aspect, near, far) {
    this.aspect = aspect;
    this.near = near;
    this.far = far;
    this.setFOV(fov);
    this.transform = new Transform({});
    this.viewMatrix = VMath.getI4();
    this.height = 0;
    this.distance = 0;
    this.pitch = 0;
    this.rotationY = 0;
  }
  getPosition() {
    return this.transform.position;
  }
  setLocation(height, distance, pitch, rotationY) {
    this.height = height;
    this.distance = valueOrDefault(distance, this.distance);
    this.pitch = valueOrDefault(pitch, this.pitch);
    this.rotationY = valueOrDefault(rotationY, this.rotationY);
    const Ry = VMath.rotationMatrixAroundY(VMath.degToRad(this.rotationY));
    const p = math.multiply(Ry, [0, this.height, this.distance]);
    this.transform.position = p;
    this.transform.eulerAngles = [this.pitch, this.rotationY, 0];
    const M = this.transform.toMatrix();
    // viewMatrix is the inverse, and we transpose it because
    // the shader expects matrices in column order
    const V = math.transpose(math.inv(M));
    this.viewMatrix = [].concat(...V);
  }
  setFOV(fov) {
    this.fov = fov;
    const { aspect, near, far } = this;
    this.projectionMatrix = VMath.getProjection(fov, aspect, near, far);
    this.projectionInverse = VMath.getProjectionInverse(fov, aspect, near, far);
  }
  rayFromScreenCoordinates(clipx, clipy) {
    const screenHalfway = [clipx, clipy, 0.75, 1];
    const viewW = VMath.mulVector(this.projectionInverse, screenHalfway);
    const viewHalfway = viewW.map(a => a / viewW[3]);
    const M = this.transform.toMatrix();
    const worldHalfway = math.multiply(M, viewHalfway);
    const start = this.transform.position;
    const direction = VMath.normalize(VMath.diff(worldHalfway.slice(0, 3), start));
    return { start, direction };
  }
  // like the Projection, but without near/far normalization, and pixel-scaled
  getIntrinsicMatrix(width, height) {
    const k = height / (2.0 * Math.tan(VMath.degToRad(this.fov / 2)));
    return [
      [k, 0, width / 2.0],
      [0, k, height / 2.0],
      [0, 0, 1],
    ];
  }
  // Intrinsic * View, using OpenCV coordinate system, where Y is down
  getIntrinsicViewMatrix(width, height) {
    let K = this.getIntrinsicMatrix(width, height);
    K = math.resize(K, [4, 4]);
    K[3][3] = 1;
    let V = math.reshape(this.viewMatrix, [4, 4]);
    // transpose it, because it's stored in column-order
    V = math.transpose(V);
    const KV = math.multiply(K, V);
    // we can get rid of last row, should be [0, 0, 0, 1]
    return math.resize(KV, [3, 4]);
  }
  getFlippedRotation() {
    const M = this.viewMatrix;
    let R = [
      M[0], M[1], M[2],
      M[4], M[5], -M[6],
      M[8], -M[9], M[10]
    ];
    return R;
  }
  worldToPixels(world, width, height) {
    const view = VMath.mulVector(this.viewMatrix, world);
    const clip = VMath.mulVector(this.projectionMatrix, view);
    clip[0] /= clip[3]; clip[1] /= clip[3];
    // convert from clipspace to pixels
    return [(clip[0] * 0.5 + 0.5) * width, (clip[1] * -0.5 + 0.5) * height];
  }
}
export { Camera as default };
