import VMath from './math.js';

const MAX_JOINTS = 100;

function arrayValueOrDefault(array, index, def) {
  if (array && array[index]) {
    return array[index];
  }    
  return def;
}

function substractJointTranslationsFromAnims(skeleton, anims) {
  const animKeys = Object.keys(anims);
  animKeys.forEach((joint) => {
    if (anims[joint].translation) {
      for (let i = 0; i < anims[joint].translation.length; i += 1) {
        if (anims[joint].translation[i]) {
          anims[joint].translation[i][0] -= skeleton[joint].transform[3];
          anims[joint].translation[i][1] -= skeleton[joint].transform[7];
          anims[joint].translation[i][2] -= skeleton[joint].transform[11];
        }
      }
    }
  });
  return anims;
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
    const { transform } = this.skeleton[name];
    const s = arrayValueOrDefault(jointAnim.scale, keyframe, [1, 1, 1]);
    const t = arrayValueOrDefault(jointAnim.translation, keyframe, [0, 0, 0]);
    const rx = VMath.degToRad(arrayValueOrDefault(jointAnim['rotateX.ANGLE'], keyframe, 0));
    const ry = VMath.degToRad(arrayValueOrDefault(jointAnim['rotateY.ANGLE'], keyframe, 0));
    const rz = VMath.degToRad(arrayValueOrDefault(jointAnim['rotateZ.ANGLE'], keyframe, 0));
    const ms = VMath.getI4();
    /* eslint-disable prefer-destructuring */
    ms[0] = s[0];
    ms[5] = s[1];
    ms[10] = s[2];
    /* eslint-enable prefer-destructuring */
    const mt = VMath.getI4();
    // row-major
    mt[3] = transform[3] + t[0];
    mt[7] = transform[7] + t[1];
    mt[11] = transform[11] + t[2];
    const mr = {
      x: VMath.rotateX(VMath.getI4(), rx),
      y: VMath.rotateY(VMath.getI4(), ry),
      z: VMath.rotateZ(VMath.getI4(), rz),
    };
    // rotations are column-major! convert to row-major
    mr.x = VMath.transpose(mr.x);
    mr.y = VMath.transpose(mr.y);
    mr.z = VMath.transpose(mr.z);
    const order = this.skeleton[name].rotationOrder || 'xyz';
    let m = VMath.mulMatrix(mr[order[0]], mr[order[1]]);
    m = VMath.mulMatrix(m, mr[order[2]]);
    m = VMath.mulMatrix(m, ms);
    m = VMath.mulMatrix(mt, m);
    return m;
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
}
export { SkinnedModel as default };
