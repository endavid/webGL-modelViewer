import VMath from './math.js';

function setColor(context, color) {
  context.fillStyle = color;
  context.strokeStyle = color;
  context.textAlign = 'center';
}

function drawLabel(ctx, point, label, color, shadowColor) {
  // save all the canvas settings
  ctx.save();
  // translate the canvas origin so 0, 0 is at
  // the top front right corner of our F
  ctx.translate(point[0], point[1]);
  // draw an arrow
  ctx.beginPath();
  ctx.moveTo(10, 5);
  ctx.lineTo(0, 0);
  ctx.lineTo(5, 10);
  ctx.moveTo(0, 0);
  ctx.lineTo(15, 15);
  ctx.stroke();
  // draw the text.
  setColor(ctx, shadowColor);
  ctx.fillText(label, 21, 25);
  setColor(ctx, color);
  ctx.fillText(label, 20, 24);
  // restore the canvas to its old settings.
  ctx.restore();
}

class PluginSkeleton {
  constructor() {
    this.colors = {
      root: '#999999',
      bone: '#00ff00',
      selected: '#ff00ff',
      unparented: '#ff0000',
      shadow: '#000000',
    };
  }
  draw(context, scene, camera) {
    const self = this;
    const { canvas } = context;
    const { width, height } = canvas;
    const [mainModel] = scene.models;
    if (!mainModel) {
      return;
    }
    const { skinnedModel } = mainModel;
    if (skinnedModel && skinnedModel.showSkeleton) {
      const modelMatrix = mainModel.getTransformMatrix();
      const {
        jointNames, jointIndices, skeleton, currentKeyframe,
      } = skinnedModel;
      const getJointPosition = (index) => {
        const p = skinnedModel.getJointPosition(index, currentKeyframe);
        return VMath.mulVector(modelMatrix, p.concat(1));
      };
      for (let i = 0; i < jointNames.length; i += 1) {
        const name = jointNames[i];
        const node = skeleton[name];
        if (!node) {
          // this means the names in the rig do not correspond
          // to the names in poses! Bad COLLADA!
          // eslint-disable-next-line no-continue
          continue;
        }
        const { parent } = node;
        const w1 = getJointPosition(i);
        const p1 = camera.worldToPixels(w1, width, height);
        const jointColor = PluginSkeleton.getJointColor(skinnedModel, name);
        const shadowColor = name === skinnedModel.selectedJoint ? self.colors.selected
          : self.colors.shadow;
        if (!parent) {
          setColor(context, self.colors.root);
          PluginSkeleton.drawCircle(context, p1);
          if (skinnedModel.showJointLabels) {
            drawLabel(context, p1, name, jointColor, shadowColor);
          }
          // eslint-disable-next-line no-continue
          continue;
        }
        const j = jointIndices[parent];
        if (j === undefined) {
          setColor(context, self.colors.unparented);
          PluginSkeleton.drawCircle(context, p1);
          if (skinnedModel.showJointLabels) {
            drawLabel(context, p1, name, jointColor, shadowColor);
          }
          // eslint-disable-next-line no-continue
          continue;
        }
        const color = name === skinnedModel.selectedJoint ? self.colors.selected : self.colors.bone;
        setColor(context, color);
        const w0 = getJointPosition(jointIndices[parent]);
        const p0 = camera.worldToPixels(w0, width, height);
        PluginSkeleton.drawLine(context, p0, p1);
        PluginSkeleton.drawCircle(context, p1);
        if (skinnedModel.showJointLabels) {
          drawLabel(context, p1, name, jointColor, shadowColor);
        }
      }
    }
  }
  static getJointColor(skinnedModel, jointName) {
    const jointIndex = skinnedModel.jointIndices[jointName];
    const colorVector = skinnedModel.jointColorPalette.slice(4 * jointIndex, 4 * jointIndex + 3);
    return VMath.vectorToHexColor(colorVector);
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
