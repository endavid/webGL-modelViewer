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
  animKeys.forEach(function (joint) {
    if (anims[joint].translation) {
      for (let i = 0; i < anims[joint].translation.length; i++) {
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
    for (let i = 0; i < skin.joints.length; i++) {
      this.jointIndices[skin.joints[i]] = i;
    }
    this.inverseBindMatrices = skin.bindPoses;
    this.skeleton = skeleton;
    this.applyDefaultPose();
    const animKeys = Object.keys(anims);
    this.keyframeCount = animKeys.length > 0 ? anims[animKeys[0]].keyframes.length : 0;
    this.anims = substractJointTranslationsFromAnims(skeleton, anims);
    //this.applyPose(0);
  }
  /// JointMatrix * InvBindMatrix
  applyDefaultPose() {
    for (let i = 0; i < this.jointNames.length; i++) {
      const m = VMath.mulMatrix(this.getDefaultPoseMatrix(i), this.inverseBindMatrices[i]);
      // convert row-major to column-major, GL-ready
      VMath.transpose(m, this.joints, i * 16);
    }
  }
  applyPose(keyframe) {
    for (let i = 0; i < this.jointNames.length; i++) {
      const m = VMath.mulMatrix(this.getAnimMatrix(i, keyframe), this.inverseBindMatrices[i]);
      // convert row-major to column-major, GL-ready
      VMath.transpose(m, this.joints, i * 16);
    }
  }
  getDefaultPoseMatrix(i) {
    const name = this.jointNames[i];
    var node = this.skeleton[name];
    var m = node.transform;
    var parent = node.parent;
    while (parent) {
      node = this.skeleton[parent];
      m = VMath.mulMatrix(node.transform, m);
      parent = node.parent;
    }
    // m = armatureTransform * m;
    return m;
  }
  getJointMatrix(name, keyframe) {
    var jointAnim = this.anims[name] || {};
    if (jointAnim.transform && jointAnim.transform[keyframe]) {
      return jointAnim.transform[keyframe];
    }
    const transform = this.skeleton[name].transform;
    const s = arrayValueOrDefault(jointAnim.scale, keyframe, [1, 1, 1]);
    const t = arrayValueOrDefault(jointAnim.translation, keyframe, [0, 0, 0]);
    const rx = VMath.degToRad(arrayValueOrDefault(jointAnim["rotateX.ANGLE"], keyframe, 0));
    const ry = VMath.degToRad(arrayValueOrDefault(jointAnim["rotateY.ANGLE"], keyframe, 0));
    const rz = VMath.degToRad(arrayValueOrDefault(jointAnim["rotateZ.ANGLE"], keyframe, 0));
    var ms = VMath.getI4();
    ms[0] = s[0];
    ms[5] = s[1];
    ms[10] = s[2];
    var mt = VMath.getI4();
    // row-major
    mt[3] = transform[3] + t[0];
    mt[7] = transform[7] + t[1];
    mt[11] = transform[11] + t[2];
    var mr = {
      x: VMath.rotateX(VMath.getI4(), rx),
      y: VMath.rotateY(VMath.getI4(), ry),
      z: VMath.rotateZ(VMath.getI4(), rz)
    };
    // rotations are column-major! convert to row-major
    mr.x = VMath.transpose(mr.x);
    mr.y = VMath.transpose(mr.y);
    mr.z = VMath.transpose(mr.z);
    const order = this.skeleton[name].rotationOrder || "xyz";
    var m = VMath.mulMatrix(mr[order[0]], mr[order[1]]);
    m = VMath.mulMatrix(m, mr[order[2]]);
    m = VMath.mulMatrix(m, ms);
    m = VMath.mulMatrix(mt, m);
    return m;
  }
  getAnimMatrix(i, keyframe) {
    const name = this.jointNames[i];
    var node = this.skeleton[name];
    var m = this.getJointMatrix(name, keyframe);
    var parent = node.parent;
    while (parent) {
      node = this.skeleton[parent];
      const pm = this.getJointMatrix(parent, keyframe);
      m = VMath.mulMatrix(pm, m);
      parent = node.parent;
    }
    // m = armatureTransform * m;
    return m;
  }
  addPose(pose) {
    var anims = this.anims;
    const keys = Object.keys(pose);
    const frame = this.keyframeCount;
    keys.forEach(function (joint) {
      if (!anims[joint]) {
        anims[joint] = {};
      }
      ["X", "Y", "Z"].forEach(function (axis, i) {
        const k = "rotate" + axis + ".ANGLE";
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
    var skeleton = this.skeleton;
    const keys = Object.keys(jro);
    keys.forEach(function (joint) {
      if (skeleton[joint]) {
        skeleton[joint].rotationOrder = jro[joint];
      }
    });
  }
  getPoseFile(keyframe) {
    const joints = Object.keys(this.anims);
    const anims = this.anims;
    var pose = {};
    joints.forEach(function (joint) {
      const jointAnim = anims[joint];
      var hasRotation = false;
      ["X", "Y", "Z"].forEach(function (axis) {
        const k = "rotate" + axis + ".ANGLE";
        hasRotation |= jointAnim[k] && jointAnim[k][keyframe];
      });
      const hasScale = jointAnim.scale && jointAnim.scale[keyframe];
      const hasTranslation = jointAnim.translation && jointAnim.translation[keyframe];
      if (hasRotation || hasScale || hasTranslation) {
        let t = [];
        ["X", "Y", "Z"].forEach(function (axis) {
          var k = "rotate" + axis + ".ANGLE";
          var r = arrayValueOrDefault(jointAnim[k], keyframe, 0);
          t.push(r);
        });
        if (hasScale || hasTranslation) {
          const s = arrayValueOrDefault(jointAnim.scale, keyframe, [1, 1, 1]);
          s.forEach(function (v) { t.push(v); });
          if (hasTranslation) {
            const x = arrayValueOrDefault(jointAnim.translation, keyframe, [0, 0, 0]);
            x.forEach(function (v) { t.push(v); });
          }
        }
        pose[joint] = t;
      }
    });
    return { pose: pose };
  }
  setAnimValue(joint, frame, key, value, index) {
    if (!this.anims[joint]) {
      this.anims[joint] = {};
    }
    var jointAnim = this.anims[joint];
    if (!jointAnim[key]) {
      jointAnim[key] = [];
    }
    if (index !== undefined) {
      if (!jointAnim[key][frame]) {
        jointAnim[key][frame] = [0, 0, 0];
      }
      jointAnim[key][frame][index] = value;
    }
    else {
      jointAnim[key][frame] = value;
    }
  }
  getSkeletonTopology(parentJoint) {
    var self = this;
    const joints = Object.keys(this.skeleton);
    const parent = parentJoint || null;
    var topo = {};
    joints.forEach(function (joint) {
      const j = self.skeleton[joint];
      if (j && j.parent === parent) {
        topo[joint] = self.getSkeletonTopology(joint);
      }
    });
    return topo;
  }
}
export {SkinnedModel as default};

