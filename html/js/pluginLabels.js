import MATH from './math.js';

class PluginLabels {
  constructor() {}
  draw(context, scene, deltaTime) {
    const canvas = context.canvas;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#ffffff";
    context.strokeStyle = "#ffffff";
    const labels = scene.labels;
    function worldToPixels(world) {
      var view = MATH.mulVector(scene.camera.viewMatrix, world);
      var clip = MATH.mulVector(scene.camera.projectionMatrix, view);
      clip[0] /= clip[3]; clip[1] /= clip[3];
      // convert from clipspace to pixels
      return [(clip[0] *  0.5 + 0.5) * canvas.width, (clip[1] * -0.5 + 0.5) * canvas.height];
    }
    Object.keys(labels.world).forEach(function (k) {
      var pos = labels.world[k];
      pos[3] = 1;
      var pix = worldToPixels(pos);
      PluginLabels.drawLabel(context, pix[0], pix[1], k);
    });
    Object.keys(labels.model).forEach(function (k) {
      var pos = labels.model[k];
      pos[3] = 1;
      var world = MATH.mulVector(modelMatrix, pos);
      var pix = worldToPixels(world);
      PluginLabels.drawLabel(context, pix[0], pix[1], k);
    });
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
export {PluginLabels as default};