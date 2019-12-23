import VMath from './math.js';

class PluginLabels {
  constructor() {
    this.fillStyle = '#ffffff';
    this.strokeStyke = '#ffffff';
  }
  setStyle(context) {
    /* eslint-disable no-param-reassign */
    context.fillStyle = this.fillStyle;
    context.strokeStyle = this.strokeStyke;
    /* eslint-enable no-param-reassign */
  }
  draw(context, scene) {
    const { canvas } = context;
    context.clearRect(0, 0, canvas.width, canvas.height);
    this.setStyle(context);
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
    Object.keys(labels.world).forEach((k) => {
      const pos = VMath.readCoordinates(labels.world[k]);
      const pix = worldToPixels(pos);
      PluginLabels.drawLabel(context, pix[0], pix[1], k);
    });
    const [mainModel] = scene.models;
    if (mainModel && mainModel.labels) {
      const modelMatrix = mainModel.getTransformMatrix();
      Object.keys(mainModel.labels).forEach((k) => {
        const label = mainModel.labels[k];
        if (scene.labelFilter && !scene.labelFilter(label)) {
          return;
        }
        const pos = mainModel.getPositionForLabel(k);
        const posScaled = VMath.mulScalar(pos, labels.scale).concat(1);
        const world = VMath.mulVector(modelMatrix, posScaled);
        const pix = worldToPixels(world);
        PluginLabels.drawLabel(context, pix[0], pix[1], k);
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
