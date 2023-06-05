import VMath from './math.js';

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
    this.viewer.requestRedraw();
  }
  cameraFov(i) {
    const idx = i || this.config.selectedCamera;
    const camera = this.viewer.getCamera(idx);
    const cfgCamera = this.config.cameras[idx];
    camera.setFOV(cfgCamera.fov);
    this.viewer.requestRedraw();
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
    this.viewer.requestRedraw();
  }
  cameraTarget(value, axis) {
    const camera = this.viewer.getCamera(this.config.selectedCamera);
    const cfgCamera = this.config.cameras[this.config.selectedCamera];
    cfgCamera.eye.target[axis] = parseFloat(value);
    camera.setEye(cfgCamera.eye);
    this.viewer.requestRedraw();
  }
  cameraUp(value, axis) {
    const camera = this.viewer.getCamera(this.config.selectedCamera);
    const cfgCamera = this.config.cameras[this.config.selectedCamera];
    cfgCamera.eye.up[axis] = parseFloat(value);
    camera.setEye(cfgCamera.eye);
    this.viewer.requestRedraw();
  }
  cameraInitFromFile(config) {
    const camera = this.viewer.getCamera(this.config.selectedCamera);
    camera.initFromFile(config);
    this.uiSetter.camera.fov(camera.fov);
    this.uiSetter.camera.distance(camera.distance);
    this.uiSetter.camera.height(camera.height);
    this.uiSetter.camera.offsetX(camera.offsetX);
    const pitch = VMath.round(camera.pitch, 2);
    const rotationY = VMath.round(camera.rotationY, 2);
    this.uiSetter.camera.pitch(pitch);
    this.uiSetter.camera.rotationY(rotationY);
    this.viewer.requestRedraw();
  }
  clearAlpha(a) {
    this.config.clear.alpha = a;
    this.viewer.setBackgroundColor(this.config.clear.color, a);
  }
  clearColor(event) {
    const intValue = parseInt(event.target.value.slice(1), 16);
    this.config.clear.color = intValue;
    this.viewer.setBackgroundColor(intValue, this.config.clear.alpha);
  }
  depthNear(value) {
    this.config.depthNear = value;
    this.viewer.scene.depthNear = value;
    this.viewer.requestRedraw();
  }
  depthFar(value) {
    this.config.depthFar = value;
    this.viewer.scene.depthFar = value;
    this.viewer.requestRedraw();
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
    this.viewer.requestRedraw();
  }
  sunEastWest(ew) {
    this.viewer.scene.lights[0].setEastWest(ew);
    this.viewer.requestRedraw();
  }
  sunIntensity(i) {
    this.viewer.scene.lights[0].setIntensity(i);
    this.viewer.requestRedraw();
  }
  sunAlpha(a) {
    this.viewer.scene.lights[0].setAlpha(a);
    this.viewer.requestRedraw();
  }
  sun() {
    const sun = this.viewer.scene.lights[0];
    sun.setAltitude(this.config.sun.altitude);
    sun.setEastWest(this.config.sun.eastWest);
    sun.setIntensity(this.config.sun.intensity);
    sun.setAlpha(this.config.sun.alpha);
    this.viewer.requestRedraw();
  }
  jointSelection(obj) {
    console.log(obj);
    const model = this.viewer.getSelectedModel();
    if (model && model.skinnedModel) {
      model.skinnedModel.selectedJoint = obj.value;
      this.uiSetter.anim.updateJointControls();
      this.uiSetter.anim.updateJointColor();
      this.viewer.requestRedraw();
    }
  }
}

export default ControlsUpdater;
