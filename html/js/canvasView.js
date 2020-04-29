import Camera from './camera.js';

class CanvasView {
  constructor(rect) {
    const {width, height} = rect;
    this.rect = rect;
    const aspect = width / height;
    this.background = {};
    this.camera = new Camera(33.4, aspect, 0.1, 500);
  }
}

export { CanvasView as default };