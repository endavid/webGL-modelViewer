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
    console.log(worldHalfway);
    const start = this.transform.position;
    const direction = VMath.normalize(VMath.diff(worldHalfway.slice(0, 3), start));
    return { start, direction };
  }
}
export { Camera as default };
