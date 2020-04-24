import VMath from './math.js';

class PluginSkeleton {
  constructor() {
    this.colors = {
      multiple: '#999999',
      single: '#00ff00'
    }
  }
  setColor(context, color) {
    /* eslint-disable no-param-reassign */
    context.fillStyle = color;
    context.strokeStyle = color;
    context.textAlign = 'center';
    /* eslint-enable no-param-reassign */
  }
  draw(context, scene) {
    const self = this;
    const { canvas } = context;
    const { width, height } = canvas;
    const { camera } = scene;
    const [mainModel] = scene.models;
    if (!mainModel) {
      return;
    }
    const { skinnedModel } = mainModel;
    if (skinnedModel && skinnedModel.showSkeleton) {
      self.setColor(context, self.colors.single);
      const modelMatrix = mainModel.getTransformMatrix();
      const { jointNames, jointIndices, skeleton, currentKeyframe } = skinnedModel;
      function getJointPosition(index) {
        const m = skinnedModel.getAnimMatrix(index, currentKeyframe);
        const p = [m[3], m[7], m[11], 1];
        return VMath.mulVector(modelMatrix, p);
      }
      for (let i = 0; i < jointNames.length; i += 1) {
        const name = jointNames[i];
        const node = skeleton[name];
        const { parent } = node;
        if (!parent) {
          continue;
        }
        const j = jointIndices[parent];
        if (j === undefined) {
          continue;
        }
        const w0 = getJointPosition(jointIndices[parent]);
        const w1 = getJointPosition(i);
        const p0 = camera.worldToPixels(w0, width, height);
        const p1 = camera.worldToPixels(w1, width, height);
        PluginSkeleton.drawLine(context, p0, p1);
        PluginSkeleton.drawCircle(context, p1);
      }
    }
  }
  static drawLine(ctx, from, to) {
    const tx = to[0] - from[0];
    const ty = to[1] - from[1];
    // save all the canvas settings
    ctx.save();
    ctx.translate(from[0], from[1]);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    // restore the canvas to its old settings.
    ctx.restore();
  }
  static drawCircle(ctx, point) {
    ctx.save();
    ctx.translate(point[0], point[1]);
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, 2 * Math.PI, false);
    ctx.stroke();
    ctx.restore();
  }
}
export { PluginSkeleton as default };
