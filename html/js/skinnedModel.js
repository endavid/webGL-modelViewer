import VMath from './math.js';

const { math } = window;

const MAX_JOINTS = 100;

// generated with http://palettist.endavid.com/
const JOINT_PALETTE = [
  0, 0, 0, 1,
  0.635, 0.733, 0.945, 1,
  0.329, 0.541, 0.953, 1,
  0.839, 0.624, 1, 1,
  1, 0.655, 0.945, 1,
  0.69, 0.988, 1, 1,
  1, 0.651, 0.647, 1,
  0.02, 0.871, 0.949, 1,
  0.369, 1, 0.973, 1,
  1, 0.318, 0.298, 1,
  0.5, 0, 0, 1,
  0, 1, 0, 1,
  1, 0.31, 0.773, 1,
  1, 0, 0, 1,
  0.25, 0, 0, 1,
  0, 0, 0.63, 1,
  1, 0, 0.788, 1,
  1, 0.02, 0, 1,
  1, 0.831, 0, 1,
  0.478, 1, 0.016, 1,
  0.675, 0.373, 1, 1,
  0.596, 0.024, 1, 1,
  0, 0.239, 0.945, 1,
  1, 1, 0, 1,
  1, 0.5, 0, 1,
  0.875, 0.773, 0.314, 1,
];

function arrayValueOrDefault(array, index, def) {
  if (array && array[index]) {
    return array[index];
  }
  return def;
}

function substractJointTranslationsFromAnims(skeleton, anims) {
  const animKeys = Object.keys(anims);
  const a = anims;
  animKeys.forEach((joint) => {
    if (anims[joint].translation) {
      for (let i = 0; i < anims[joint].translation.length; i += 1) {
        if (anims[joint].translation[i]) {
          if (!skeleton[joint]) {
            console.warn(`Skipping animation for non-existing joint: ${joint}`);
            // eslint-disable-next-line no-continue
            continue;
          }
          a[joint].translation[i][0] -= skeleton[joint].transform[3];
          a[joint].translation[i][1] -= skeleton[joint].transform[7];
          a[joint].translation[i][2] -= skeleton[joint].transform[11];
        }
      }
    }
  });
  return a;
}

function createJointColorPalette(joints) {
  const numColors = JOINT_PALETTE.length / 4;
  const count = joints.length;
  const palette = new Float32Array(count * 4);
  const jointColorHash = {};
  for (let i = 0, j = 0; i < count; i += 1) {
    // try to detect symmetric joints by removing starting or ending Ls/Rs
    const jointKey = joints[i].substr(1, joints[i].length - 2);
    const colorIndex = j % numColors;
    let color = JOINT_PALETTE.slice(4 * colorIndex, 4 * colorIndex + 4);
    if (jointColorHash[jointKey]) {
      color = jointColorHash[jointKey];
    } else {
      jointColorHash[jointKey] = color;
      j += 1;
    }
    for (let c = 0; c < 4; c += 1) {
      palette[4 * i + c] = color[c];
    }
  }
  return palette;
}

function getJointMatrix(index, matrices) {
  const i = index * 16;
  const m = matrices.slice(i, i + 16);
  return math.reshape(m, [4, 4]);
}


class SkinnedModel {
  constructor(skin, skeleton, anims) {
    this.joints = new Array(MAX_JOINTS * 16);
    for (let offset = 0; offset < 16 * MAX_JOINTS; offset += 16) {
      VMath.setI4(this.joints, offset);
    }
    this.jointNames = skin.joints;
    this.jointIndices = {};
    for (let i = 0; i < skin.joints.length; i += 1) {
      this.jointIndices[skin.joints[i]] = i;
    }
    this.inverseBindMatrices = skin.bindPoses;
    this.skeleton = skeleton;
    this.applyDefaultPose();
    const animKeys = Object.keys(anims);
    this.keyframeCount = animKeys.length > 0 ? anims[animKeys[0]].keyframes.length : 0;
    this.anims = substractJointTranslationsFromAnims(skeleton, anims);
    this.jointColorPalette = createJointColorPalette(skin.joints);
    // this.applyPose(0);
  }
  // JointMatrix * InvBindMatrix
  applyDefaultPose() {
    for (let i = 0; i < this.jointNames.length; i += 1) {
      const m = VMath.mulMatrix(this.getDefaultPoseMatrix(i), this.inverseBindMatrices[i]);
      // convert row-major to column-major, GL-ready
      VMath.transpose(m, this.joints, i * 16);
    }
  }
  applyPose(keyframe) {
    for (let i = 0; i < this.jointNames.length; i += 1) {
      const m = VMath.mulMatrix(this.getAnimMatrix(i, keyframe), this.inverseBindMatrices[i]);
      // convert row-major to column-major, GL-ready
      VMath.transpose(m, this.joints, i * 16);
    }
  }
  getDefaultPoseMatrix(i) {
    const name = this.jointNames[i];
    let node = this.skeleton[name];
    if (!node) {
      return VMath.getI4();
    }
    let m = node.transform;
    let { parent } = node;
    while (parent) {
      node = this.skeleton[parent];
      m = VMath.mulMatrix(node.transform, m);
      // eslint-disable-next-line prefer-destructuring
      parent = node.parent;
    }
    // m = armatureTransform * m;
    return m;
  }
  getJointMatrix(name, keyframe) {
    const jointAnim = this.anims[name] || {};
    if (jointAnim.transform && jointAnim.transform[keyframe]) {
      return jointAnim.transform[keyframe];
    }
    // we'll use the transform to get only the translation and
    // assume the rig does not contains rotations or scalings... ^^;
    const { transform } = this.skeleton[name];
    const s = arrayValueOrDefault(jointAnim.scale, keyframe, [1, 1, 1]);
    const t = arrayValueOrDefault(jointAnim.translation, keyframe, [0, 0, 0]);
    const rx = VMath.degToRad(arrayValueOrDefault(jointAnim['rotateX.ANGLE'], keyframe, 0));
    const ry = VMath.degToRad(arrayValueOrDefault(jointAnim['rotateY.ANGLE'], keyframe, 0));
    const rz = VMath.degToRad(arrayValueOrDefault(jointAnim['rotateZ.ANGLE'], keyframe, 0));
    const ms = math.diag(s.concat(1));
    const mt = math.diag([1, 1, 1, 1]); // identity
    // row-major
    mt[0][3] = transform[3] + t[0];
    mt[1][3] = transform[7] + t[1];
    mt[2][3] = transform[11] + t[2];
    const order = this.skeleton[name].rotationOrder || 'xyz';
    let m = VMath.rotationMatrixFromEuler([rx, ry, rz], order);
    m = math.resize(m, [4, 4]);
    m[3][3] = 1;
    m = math.multiply(m, ms);
    m = math.multiply(mt, m);
    // flatten row-major matrix
    return [].concat(...m);
  }
  getAnimMatrix(i, keyframe) {
    const name = this.jointNames[i];
    let node = this.skeleton[name];
    let m = this.getJointMatrix(name, keyframe);
    let { parent } = node;
    while (parent) {
      node = this.skeleton[parent];
      const pm = this.getJointMatrix(parent, keyframe);
      m = VMath.mulMatrix(pm, m);
      // eslint-disable-next-line prefer-destructuring
      parent = node.parent;
    }
    // m = armatureTransform * m;
    return m;
  }
  addPose(pose) {
    const { anims } = this;
    const keys = Object.keys(pose);
    const frame = this.keyframeCount;
    keys.forEach((joint) => {
      if (!anims[joint]) {
        anims[joint] = {};
      }
      ['X', 'Y', 'Z'].forEach((axis, i) => {
        const k = `rotate${axis}.ANGLE`;
        if (!anims[joint][k]) {
          anims[joint][k] = [];
        }
        anims[joint][k][frame] = pose[joint][i];
      });
      if (pose[joint][5] !== undefined) {
        if (!anims[joint].scale) {
          anims[joint].scale = [];
        }
        anims[joint].scale[frame] = pose[joint].slice(3, 6);
      }
      if (pose[joint][8] !== undefined) {
        if (!anims[joint].translation) {
          anims[joint].translation = [];
        }
        anims[joint].translation[frame] = pose[joint].slice(6, 9);
      }
    });
    this.keyframeCount += 1;
  }
  updateJointRotationOrder(jro) {
    const { skeleton } = this;
    const keys = Object.keys(jro);
    keys.forEach((joint) => {
      if (skeleton[joint]) {
        skeleton[joint].rotationOrder = jro[joint];
      }
    });
  }
  getPoseFile(keyframe) {
    const joints = Object.keys(this.anims);
    const { anims } = this;
    const pose = {};
    joints.forEach((joint) => {
      const jointAnim = anims[joint];
      let hasRotation = false;
      ['X', 'Y', 'Z'].forEach((axis) => {
        const k = `rotate${axis}.ANGLE`;
        hasRotation = hasRotation || (jointAnim[k] && jointAnim[k][keyframe]);
      });
      const hasScale = jointAnim.scale && jointAnim.scale[keyframe];
      const hasTranslation = jointAnim.translation && jointAnim.translation[keyframe];
      if (hasRotation || hasScale || hasTranslation) {
        const t = [];
        ['X', 'Y', 'Z'].forEach((axis) => {
          const k = `rotate${axis}.ANGLE`;
          const r = arrayValueOrDefault(jointAnim[k], keyframe, 0);
          t.push(r);
        });
        if (hasScale || hasTranslation) {
          const s = arrayValueOrDefault(jointAnim.scale, keyframe, [1, 1, 1]);
          s.forEach((v) => { t.push(v); });
          if (hasTranslation) {
            const x = arrayValueOrDefault(jointAnim.translation, keyframe, [0, 0, 0]);
            x.forEach((v) => { t.push(v); });
          }
        }
        pose[joint] = t;
      }
    });
    return { pose };
  }
  setAnimValue(joint, frame, key, value, index) {
    if (!this.anims[joint]) {
      this.anims[joint] = {};
    }
    const jointAnim = this.anims[joint];
    if (!jointAnim[key]) {
      jointAnim[key] = [];
    }
    if (index !== undefined) {
      if (!jointAnim[key][frame]) {
        jointAnim[key][frame] = [0, 0, 0];
      }
      jointAnim[key][frame][index] = value;
    } else {
      jointAnim[key][frame] = value;
    }
  }
  getSkeletonTopology(parentJoint) {
    const self = this;
    const joints = Object.keys(this.skeleton);
    const parent = parentJoint || null;
    const topo = {};
    joints.forEach((joint) => {
      const j = self.skeleton[joint];
      if (j && j.parent === parent) {
        topo[joint] = self.getSkeletonTopology(joint);
      }
    });
    return topo;
  }
  // CPU skinning (slow, so use it only for a few labels)
  getSkinnedVertex(position, weights, indices) {
    const self = this;
    const p = position.slice(0, 3);
    p[3] = 1;
    let sum = [0, 0, 0, 1];
    indices.forEach((index, i) => {
      const w = weights[i];
      const M = getJointMatrix(index, self.joints);
      // multiply from left, because the matrix is transposed
      // since it's stored in column order
      const pi = math.multiply(p, M);
      sum = math.add(sum, math.multiply(pi, w));
    });
    return sum;
  }
}
export { SkinnedModel as default };
