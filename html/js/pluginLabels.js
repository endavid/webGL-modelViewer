import VMath from './math.js';

function setColor(context, color) {
  context.fillStyle = color;
  context.strokeStyle = color;
  context.textAlign = 'center';
}

function setFontSizePt(context, size) {
  context.font = `normal ${size}pt serif`;
}

class PluginLabels {
  constructor() {
    this.colors = {
      world: '#999999',
      model: '#ffffff',
      selected: '#00ff00',
    };
  }
  draw(context, scene, camera) {
    const self = this;
    const { canvas } = context;
    context.clearRect(0, 0, canvas.width, canvas.height);
    const { labels } = scene;
    if (!labels.showLabels) {
      return;
    }
    setColor(context, self.colors.world);
    setFontSizePt(context, 16);
    Object.keys(labels.world).forEach((k) => {
      const pos = VMath.readCoordinates(labels.world[k]);
      const pix = camera.worldToPixels(pos, canvas.width, canvas.height);
      PluginLabels.drawLabel(context, pix[0], pix[1], k);
    });
    const [mainModel] = scene.models;
    if (mainModel && mainModel.labels) {
      const modelMatrix = mainModel.getTransformMatrix();
      setColor(context, self.colors.model);
      const { selected } = scene.labels;
      Object.keys(mainModel.labels).forEach((k) => {
        const label = mainModel.labels[k];
        if (scene.labelFilter && !scene.labelFilter(k, label)) {
          return;
        }
        const pos = mainModel.getPositionForLabel(k);
        const posScaled = VMath.mulScalar(pos, labels.scale).concat(1);
        const world = VMath.mulVector(modelMatrix, posScaled);
        const pix = camera.worldToPixels(world, canvas.width, canvas.height);
        if (k === selected) {
          setColor(context, self.colors.selected);
        }
        PluginLabels.drawLabel(context, pix[0], pix[1], k);
        if (k === selected) {
          setColor(context, self.colors.model);
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
    ctx.fillText(label, 20, 24);
    // restore the canvas to its old settings.
    ctx.restore();
  }
}
export { PluginLabels as default };
