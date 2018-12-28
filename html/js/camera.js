import MATH from './math.js';

class Camera {
  constructor(fov, aspect, near, far) {
    this.aspect = aspect;
    this.near = near;
    this.far = far;
    this.setFOV(fov);
    this.viewMatrix = MATH.getI4();
  }
  reset() {
    MATH.setI4(this.viewMatrix);
  }
  setPosition(x, y, z) {
    this.viewMatrix[12] = x;
    this.viewMatrix[13] = y;
    this.viewMatrix[14] = z;
  }
  setPitch(degrees) {
    MATH.rotateX(this.viewMatrix, MATH.degToRad(degrees));
  }
  setFOV(fov) {
    this.fov = fov;
    this.projectionMatrix = MATH.getProjection(fov, this.aspect, this.near, this.far);
  }
}
export {Camera as default};