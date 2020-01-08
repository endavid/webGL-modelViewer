import VMath from './math.js';

class PluginLabels {
  constructor() {
    this.colors = {
      world: '#999999',
      model: '#ffffff',
      selected: '#00ff00'
    }
  }
  setColor(context, color) {
    /* eslint-disable no-param-reassign */
    context.fillStyle = color;
    context.strokeStyle = color;
    /* eslint-enable no-param-reassign */
  }
  draw(context, scene) {
    const self = this;
    const { canvas } = context;
    context.clearRect(0, 0, canvas.width, canvas.height);
    const { labels } = scene;
    if (!labels.showLabels) {
      return;
    }
    function worldToPixels(world) {
      const view = VMath.mulVector(scene.camera.viewMatrix, world);
      const clip = VMath.mulVector(scene.camera.projectionMatrix, view);
      clip[0] /= clip[3]; clip[1] /= clip[3];
      // convert from clipspace to pixels
      return [(clip[0] * 0.5 + 0.5) * canvas.width, (clip[1] * -0.5 + 0.5) * canvas.height];
    }
    self.setColor(context, self.colors.world);
    Object.keys(labels.world).forEach((k) => {
      const pos = VMath.readCoordinates(labels.world[k]);
      const pix = worldToPixels(pos);
      PluginLabels.drawLabel(context, pix[0], pix[1], k);
    });
    const [mainModel] = scene.models;
    if (mainModel && mainModel.labels) {
      const modelMatrix = mainModel.getTransformMatrix();
      self.setColor(context, self.colors.model);
      const { selected } = scene.labels;
      Object.keys(mainModel.labels).forEach((k) => {
        const label = mainModel.labels[k];
        if (scene.labelFilter && !scene.labelFilter(k, label)) {
          return;
        }
        const pos = mainModel.getPositionForLabel(k);
        const posScaled = VMath.mulScalar(pos, labels.scale).concat(1);
        const world = VMath.mulVector(modelMatrix, posScaled);
        const pix = worldToPixels(world);
        if (k === selected) {
          self.setColor(context, self.colors.selected);
        }
        PluginLabels.drawLabel(context, pix[0], pix[1], k);
        if (k === selected) {
          self.setColor(context, self.colors.model);
        }
      });
    }
  }
  // https://webglfundamentals.org/webgl/lessons/webgl-text-canvas2d.html
  static drawLabel(ctx, pixelX, pixelY, label) {
    // save all the canvas settings
    ctx.save();
    // translate the canvas origin so 0, 0 is at
    // the top front right corner of our F
    ctx.translate(pixelX, pixelY);
    // draw an arrow
    ctx.beginPath();
    ctx.moveTo(10, 5);
    ctx.lineTo(0, 0);
    ctx.lineTo(5, 10);
    ctx.moveTo(0, 0);
    ctx.lineTo(15, 15);
    ctx.stroke();
    // draw the text.
    ctx.fillText(label, 20, 20);
    // restore the canvas to its old settings.
    ctx.restore();
  }
}
export { PluginLabels as default };
