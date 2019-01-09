import VMath from './math.js';

class SunLight {
  constructor(altitude, eastWest) {
    this.altitude = altitude;
    this.eastWest = eastWest;
    this.updateDirection();
  }
  updateDirection() {
    this.direction = VMath.normalize([this.eastWest, this.altitude, 1.0]);
  }
  setAltitude(v) {
    this.altitude = v;
    this.updateDirection();
  }
  setEastWest(v) {
    this.eastWest = v;
    this.updateDirection();
  }
}
// eslint-disable-next-line import/prefer-default-export
export { SunLight };
