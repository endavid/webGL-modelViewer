import VMath from './math.js';

function rotateInverse(matrix, p) {
  const m = matrix.slice(0, 16);
  VMath.setTranslation(m, [0, 0, 0]);
  return VMath.mulColumnVector(m, p.concat(1));
}

class Camera {
  constructor(fov, aspect, near, far) {
    this.aspect = aspect;
    this.near = near;
    this.far = far;
    this.setFOV(fov);
    this.viewMatrix = VMath.getI4();
    this.transformMatrix = VMath.getI4();
  }
  reset() {
    VMath.setI4(this.viewMatrix);
    VMath.setI4(this.transformMatrix);
  }
  getPosition() {
    return this.viewMatrix.slice(12, 15).map(a => -a);
  }
  setPosition(x, y, z) {
    VMath.setTranslation(this.viewMatrix, [-x, -y, -z]);
    const rp = rotateInverse(this.viewMatrix, [x, y, z]);
    VMath.setTranslation(this.transformMatrix, rp);
  }
  setPitch(degrees) {
    const a = VMath.degToRad(degrees);
    VMath.rotateX(this.viewMatrix, a);
    const p = this.getPosition();
    const rp = rotateInverse(this.viewMatrix, p);
    VMath.rotateX(this.transformMatrix, -a);
    VMath.setTranslation(this.transformMatrix, rp);
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
    const worldHalfway = VMath.mulVector(this.transformMatrix, viewHalfway);
    console.log(worldHalfway);
    const start = this.transformMatrix.slice(12, 15);
    const direction = VMath.normalize(VMath.diff(worldHalfway.slice(0, 3), start));
    return { start, direction };
  }
}
export { Camera as default };
