class ControlsUpdater {
  constructor(config, viewer, uiSetter) {
    this.config = config;
    this.viewer = viewer;
    this.uiSetter = uiSetter;
  }
  cameraLocation(i) {
    const idx = i || this.config.selectedCamera;
    const camera = this.viewer.getCamera(idx);
    const cfgCamera = this.config.cameras[idx];
    camera.setLocation(
      cfgCamera.offsetX,
      cfgCamera.height,
      cfgCamera.distance,
      cfgCamera.pitch,
      cfgCamera.rotationY,
    );
  }
  cameraFov(i) {
    const idx = i || this.config.selectedCamera;
    const camera = this.viewer.getCamera(idx);
    const cfgCamera = this.config.cameras[idx];
    camera.setFOV(cfgCamera.fov);
  }
  camera(i) {
    this.cameraLocation(i);
    this.cameraFov(i);
  }
  cameraPosition(value, axis) {
    const camera = this.viewer.getCamera(this.config.selectedCamera);
    const cfgCamera = this.config.cameras[this.config.selectedCamera];
    cfgCamera.eye.position[axis] = parseFloat(value);
    camera.setEye(cfgCamera.eye);
  }
  cameraTarget(value, axis) {
    const camera = this.viewer.getCamera(this.config.selectedCamera);
    const cfgCamera = this.config.cameras[this.config.selectedCamera];
    cfgCamera.eye.target[axis] = parseFloat(value);
    camera.setEye(cfgCamera.eye);
  }
  cameraUp(value, axis) {
    const camera = this.viewer.getCamera(this.config.selectedCamera);
    const cfgCamera = this.config.cameras[this.config.selectedCamera];
    cfgCamera.eye.up[axis] = parseFloat(value);
    camera.setEye(cfgCamera.eye);
  }
  modelTransform() {
    const p = this.config.model.position;
    const r = this.config.model.rotation;
    const s = this.config.model.scale;
    this.viewer.setModelTransform({
      position: [p.x, p.y, p.z],
      rotation: [r.x, r.y, r.z],
      scale: [s, s, s],
    });
  }
  modelScale(logValue) {
    this.config.model.scale = 10 ** parseFloat(logValue);
    this.modelTransform();
  }
  model() {
    this.modelTransform();
  }
  sunAltitude(h) {
    this.viewer.scene.lights[0].setAltitude(h);
  }
  sunEastWest(ew) {
    this.viewer.scene.lights[0].setEastWest(ew);
  }
  sunIntensity(i) {
    this.viewer.scene.lights[0].setIntensity(i);
  }
  sunAlpha(a) {
    this.viewer.scene.lights[0].setAlpha(a);
  }
  sun() {
    const sun = this.viewer.scene.lights[0];
    sun.setAltitude(this.config.sun.altitude);
    sun.setEastWest(this.config.sun.eastWest);
    sun.setIntensity(this.config.sun.intensity);
    sun.setAlpha(this.config.sun.alpha);
  }
  jointSelection(obj) {
    console.log(obj);
    const model = this.viewer.getSelectedModel();
    if (model && model.skinnedModel) {
      model.skinnedModel.selectedJoint = obj.value;
      this.uiSetter.anim.updateJointControls();
      this.uiSetter.anim.updateJointColor();
    }
  }
}

export default ControlsUpdater;
