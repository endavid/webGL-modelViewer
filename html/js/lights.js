import VMath from './math.js';

class SunLight {
  constructor(altitude, eastWest) {
    this.altitude = altitude;
    this.eastWest = eastWest;
    this.intensity = 0.8;
    this.color = [1.2, 1.1, 1.0];
    this.updateDirection();
    this.updateIrradiance();
  }
  updateDirection() {
    this.direction = VMath.normalize([this.eastWest, this.altitude, 1.0]);
  }
  updateIrradiance() {
    const { intensity, color } = this;
    this.irradiance = color.map(a => a * intensity);
  }
  setAltitude(v) {
    this.altitude = v;
    this.updateDirection();
  }
  setEastWest(v) {
    this.eastWest = v;
    this.updateDirection();
  }
  setIntensity(v) {
    this.intensity = v;
    this.updateIrradiance();
  }
}
// eslint-disable-next-line import/prefer-default-export
export { SunLight };
