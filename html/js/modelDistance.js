/* eslint-disable strict */
/* eslint-disable wrap-iife */
// eslint-disable-next-line func-names
(function (global) {
  'use strict';

  const VMath = {
    distance(a, b) {
      const v = VMath.diff(a, b);
      const norm = v.reduce((acc, c) => acc + c * c, 0);
      return Math.sqrt(norm);
    },
    sum(a, b) {
      const out = [];
      a.forEach((v, i) => {
        out.push(v + b[i]);
      });
      return out;
    },
    diff(a, b) {
      const out = [];
      a.forEach((v, i) => {
        out.push(v - b[i]);
      });
      return out;
    },
    mulScalar(v, s) {
      return v.map(a => s * a);
    },
    mulVector(m, v) {
      const out = [0, 0, 0, 0];
      // for column-major matrices
      out[0] = m[0] * v[0] + m[1] * v[1] + m[2] * v[2] + m[3] * v[3];
      out[1] = m[4] * v[0] + m[5] * v[1] + m[6] * v[2] + m[7] * v[3];
      out[2] = m[8] * v[0] + m[9] * v[1] + m[10] * v[2] + m[11] * v[3];
      out[3] = m[12] * v[0] + m[13] * v[1] + m[14] * v[2] + m[15] * v[3];
      return out;
    },
  };

  class ModelDistance {
    constructor(json) {
      // shallow copy
      Object.assign(this, json);
      this.landmarks = Object.keys(this.positions);
      this.indices = {};
      this.distances = {};
    }
    stepFindClosestPoints(step) {
      const self = this;
      const num = this.getNumVertices();
      const progress = {
        step,
        total: num,
        done: step === num,
      };
      if (progress.done) {
        return progress;
      }
      const position = this.getPosition(step);
      const skinningWeights = this.getSkinningWeights(step);
      const skinningIndices = this.getSkinningIndices(step);
      const worldPos = this.transformVertex(position, skinningWeights, skinningIndices);
      // update distance to every landmark, and remember closest vertex
      this.landmarks.forEach((key) => {
        const landmarkPos = self.getLandmarkWorldPos(key);
        const d = VMath.distance(landmarkPos, worldPos);
        const current = self.distances[key] || Number.MAX_VALUE;
        if (d < current) {
          self.distances[key] = d;
          self.indices[key] = step;
        }
      });
      return progress;
    }
    getNumVertices() {
      return this.vertices.length / this.stride;
    }
    getPosition(vertexIndex) {
      const i = vertexIndex * this.stride;
      return this.vertices.slice(i, i + 3);
    }
    getSkinningWeights(vertexIndex) {
      const i = vertexIndex * this.stride;
      return this.vertices.slice(i + 8, i + 12);
    }
    getSkinningIndices(vertexIndex) {
      const i = vertexIndex * this.stride;
      return this.vertices.slice(i + 12, i + 16);
    }
    getJointMatrix(jointIndex) {
      const i = jointIndex * 16; // 4x4 matrix
      return this.joints.slice(i, i + 16);
    }
    getLandmarkWorldPos(landmark) {
      const modelPos = this.positions[landmark].concat(1);
      const worldPos = VMath.mulVector(this.transformMatrix, modelPos);
      return worldPos.slice(0, 3);
    }
    transformVertex(position, skinningWeights, skinningIndices) {
      const self = this;
      const p = position.concat(1); // [x, y, z, 1]
      let v = [0, 0, 0, 0];
      skinningIndices.forEach((index, i) => {
        const jointMatrix = self.getJointMatrix(index);
        const pj = VMath.mulVector(jointMatrix, p);
        const weight = skinningWeights[i];
        v = VMath.sum(VMath.mulScalar(pj, weight), v);
      });
      const worldPos = VMath.mulVector(this.transformMatrix, v);
      return worldPos.slice(0, 3);
    }
  }

  // Workers do not support module exports atm (but they will: https://stackoverflow.com/a/45578811)
  // For the time being, use old export trick so we can unit-test this without a Worker
  /* eslint-disable no-param-reassign */
  /* eslint-disable no-multi-assign */
  global.ModelDistance = (global.module || {}).exports = ModelDistance;
})(this);
