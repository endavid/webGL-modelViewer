import VMath from './math.js';
import Transform from './transform.js';

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

function guessRotationOrder(jointName) {
  const cheatSheet = {
    xyz: ['foot', 'toe', 'jaw', 'tongue', 'pectoral'],
    // vertical bones, so twist is along Y, therefore applied first
    xzy: ['hip', 'pelvis', 'thigh', 'shin', 'abdomen', 'chest', 'neck', 'head'],
    yxz: ['eye'],
    yzx: ['arm', 'thumb'],
    zxy: [],
    zyx: ['collar', 'shoulder', 'shldr', 'hand', 'carpal', 'index', 'mid', 'ring', 'pinky'],
  };
  const rs = Object.keys(cheatSheet);
  const name = jointName.toLowerCase();
  for (let i = 0; i < rs.length; i += 1) {
    const ro = rs[i];
    for (let j = 0; j < cheatSheet[ro].length; j += 1) {
      if (name.indexOf(cheatSheet[ro][j]) >= 0) {
        return ro;
      }
    }
  }
  // root joint will be 'zxy' by default
  return 'zxy';
}

function standardizeAnimsToUseTransforms(skeleton, anims) {
  const animKeys = Object.keys(anims);
  const standardized = anims;
  animKeys.forEach((joint) => {
    if (!skeleton[joint]) {
      console.warn(`Skipping animation for non-existing joint: ${joint}`);
      return;
    }
    const a = anims[joint];
    const rotationOrder = skeleton[joint].rotationOrder || guessRotationOrder(joint);
    const keyframes = a.keyframes.slice(0);
    const transforms = a.keyframes.map(() => new Transform({
      position: [0, 0, 0],
      scale: [1, 1, 1],
      eulerAngles: [0, 0, 0],
      rotationOrder,
    }));
    if (a.matrix) {
      a.matrix.forEach((matrix, i) => {
        if (Array.isArray(matrix)) {
          const m = math.reshape(matrix, [4, 4]);
          const t = Transform.fromMatrix(m, rotationOrder);
          transforms[i] = t;
          const jm = skeleton[joint].matrix;
          const rigTranslation = [jm[3], jm[7], jm[11]];
          transforms[i].position = math.subtract(t.position, rigTranslation);
        }
      });
    }
    if (a.translation) {
      a.translation.forEach((translation, i) => {
        if (Array.isArray(translation)) {
          const jm = skeleton[joint].matrix;
          const rigTranslation = [jm[3], jm[7], jm[11]];
          transforms[i].position = math.subtract(translation, rigTranslation);
        }
      });
    }
    if (a.scale) {
      a.scale.forEach((scale, i) => {
        if (Array.isArray(scale)) {
          transforms[i].scale = scale;
        }
      });
    }
    ['X', 'Y', 'Z'].forEach((axis, k) => {
      const key = `rotate${axis}.ANGLE`;
      if (a[key]) {
        a[key].forEach((angle, i) => {
          transforms[i].eulerAngles[k] = angle;
        });
      }
    });
    standardized[joint] = { keyframes, transforms };
  });
  return standardized;
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
    this.anims = standardizeAnimsToUseTransforms(skeleton, anims);
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
    let m = node.matrix;
    let { parent } = node;
    while (parent) {
      node = this.skeleton[parent];
      m = VMath.mulMatrix(node.matrix, m);
      // eslint-disable-next-line prefer-destructuring
      parent = node.parent;
    }
    // m = armatureTransform * m;
    return m;
  }
  getJointMatrix(name, keyframe) {
    const jointAnim = this.anims[name] || {};
    if (jointAnim.matrix && jointAnim.matrix[keyframe]) {
      return jointAnim.matrix[keyframe];
    }
    // we'll use the transform to get only the translation and
    // assume the rig does not contains rotations or scalings... ^^;
    const { matrix } = this.skeleton[name];
    const transform = arrayValueOrDefault(jointAnim.transforms, keyframe, Transform.identity());
    const s = transform.scale;
    const t = transform.position;
    const angles = transform.eulerAngles.map(VMath.degToRad);
    const ms = math.diag(s.concat(1));
    const mt = math.diag([1, 1, 1, 1]); // identity
    // row-major
    mt[0][3] = matrix[3] + t[0];
    mt[1][3] = matrix[7] + t[1];
    mt[2][3] = matrix[11] + t[2];
    const order = this.skeleton[name].rotationOrder || guessRotationOrder(name);
    let m = VMath.rotationMatrixFromEuler(angles, order);
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
    const { anims, skeleton } = this;
    const keys = Object.keys(pose);
    const frame = this.keyframeCount;
    keys.forEach((joint) => {
      if (!anims[joint]) {
        anims[joint] = { transforms: [] };
      }
      if (!anims[joint].transforms[frame]) {
        anims[joint].transforms[frame] = new Transform({});
        if (skeleton[joint]) {
          const ro = skeleton[joint].rotationOrder || guessRotationOrder(joint);
          anims[joint].transforms[frame].rotationOrder = ro;
        }
      }
      for (let i = 0; i < 3; i += 1) {
        anims[joint].transforms[frame].eulerAngles[i] = pose[joint][i];
      }
      for (let i = 3; i < Math.min(pose[joint].length, 6); i += 1) {
        anims[joint].transforms[frame].scale[i - 3] = pose[joint][i];
      }
      for (let i = 6; i < Math.min(pose[joint].length, 9); i += 1) {
        anims[joint].transforms[frame].position[i - 6] = pose[joint][i];
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
      const transform = jointAnim.transforms[keyframe];
      if (transform) {
        let t = VMath.round(transform.eulerAngles, 2);
        const hasScale = !VMath.isClose(transform.scale, [1, 1, 1]);
        const hasTranslation = !VMath.isClose(transform.position, [0, 0, 0]);
        if (hasScale || hasTranslation) {
          t = t.concat(VMath.round(transform.scale));
          if (hasTranslation) {
            t = t.concat(VMath.round(transform.position));
          }
        }
        pose[joint] = t;
      }
    });
    return { pose };
  }
  // eslint-disable-next-line object-curly-newline
  setAnimValue({ joint, frame, key, value, index }) {
    if (!this.anims[joint]) {
      this.anims[joint] = {};
    }
    const jointAnim = this.anims[joint];
    if (!jointAnim.transforms) {
      jointAnim.transforms = [];
    }
    if (!jointAnim.transforms[frame]) {
      jointAnim.transforms[frame] = new Transform({});
    }
    jointAnim.transforms[frame][key][index] = value;
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
