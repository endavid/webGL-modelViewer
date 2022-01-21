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
    dot(a, b) {
      let s = 0;
      a.forEach((c, i) => { s += c * b[i]; });
      return s;
    },
    cross: (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]],

    isClose(a, b, epsilon) {
      const e = epsilon || 1e-6;
      return Math.abs(a - b) < e;
    },
    mulColumnVector(m, v) {
      const out = [0, 0, 0, 0];
      out[0] = m[0] * v[0] + m[1] * v[1] + m[2] * v[2] + m[3] * v[3];
      out[1] = m[4] * v[0] + m[5] * v[1] + m[6] * v[2] + m[7] * v[3];
      out[2] = m[8] * v[0] + m[9] * v[1] + m[10] * v[2] + m[11] * v[3];
      out[3] = m[12] * v[0] + m[13] * v[1] + m[14] * v[2] + m[15] * v[3];
      return out;
    },
    mulVector(m, v) {
      const out = [0, 0, 0, 0];
      // for row-major matrices
      out[0] = m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12] * v[3];
      out[1] = m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13] * v[3];
      out[2] = m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14] * v[3];
      out[3] = m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15] * v[3];
      return out;
    },
    // https://en.wikipedia.org/wiki/Möller–Trumbore_intersection_algorithm
    triangleRayIntersection(ray, triangle) {
      const e1 = VMath.diff(triangle[1], triangle[0]);
      const e2 = VMath.diff(triangle[2], triangle[0]);
      // plane normal
      const n = VMath.cross(ray.direction, e2);
      const det = VMath.dot(e1, n);
      if (VMath.isClose(det, 0)) {
        // no intersection
        return null;
      }
      const invDet = 1 / det;
      const da = VMath.diff(ray.start, triangle[0]);
      const u = VMath.dot(da, n) * invDet;
      if (u < 0 || u > 1) {
        return null;
      }
      const q = VMath.cross(da, e1);
      const v = VMath.dot(ray.direction, q) * invDet;
      if (v < 0 || (u + v) > 1) {
        return null;
      }
      const t = VMath.dot(e2, q) * invDet;
      if (t > 1e-6) {
        return t;
      }
      return null;
    },
    travelDistance(ray, distance) {
      const m = ray.direction.map(a => distance * a);
      return VMath.sum(ray.start, m);
    },
  };

  class ModelDistance {
    constructor(json) {
      // shallow copy
      Object.assign(this, json);
      this.landmarks = Object.keys(this.positions || {});
      this.indices = {};
      this.distances = {};
      if (!this.boundingBox) {
        this.boundingBox = null;
      }
    }
    step(step) {
      if (this.ray) {
        return this.stepRayIntersection(step);
      } else if (this.boundingBox) {
        return this.stepFindBoundingBox(step);
      }
      return this.stepFindClosestPoints(step);
    }
    stepFindClosestPoints(step) {
      const progress = this.getProgress(step, this.getNumVertices());
      if (progress.done) {
        return progress;
      }
      const worldPos = this.getWorldPosition(step);
      const self = this;
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
    stepFindBoundingBox(step) {
      const progress = this.getProgress(step, this.getNumVertices());
      if (progress.done) {
        return progress;
      }
      const worldPos = this.getWorldPosition(step);
      const { min, max } = this.boundingBox;
      const self = this;
      ['x', 'y', 'z'].forEach((axis, i) => {
        if (worldPos[i] < min[axis]) {
          self.boundingBox.min[axis] = worldPos[i];
        }
        if (worldPos[i] > max[axis]) {
          self.boundingBox.max[axis] = worldPos[i];
        }
      });
      return progress;
    }
    stepRayIntersection(step) {
      const progress = this.getProgress(step, this.getNumTriangles());
      if (progress.done) {
        return progress;
      }
      const t = this.getTransformedTriangle(step);
      const distance = VMath.triangleRayIntersection(this.ray, t);
      if (distance !== null) {
        if (!this.surfaceIntersection || this.surfaceIntersection.distance > distance) {
          const point = VMath.travelDistance(this.ray, distance);
          this.surfaceIntersection = { distance, point };
        }
      }
      return progress;
    }
    getProgress(step, total) {
      const progress = {
        step,
        total,
        done: step === total,
      };
      return progress
    }
    getNumVertices() {
      return this.dataArrays.position.length / 3;
    }
    getNumTriangles() {
      const numIndices = (this.triangles || []).length;
      return numIndices / 3;
    }
    getTransformedTriangle(triangleIndex) {
      const self = this;
      const i = 3 * triangleIndex;
      const indices = this.triangles.slice(i, i + 3);
      const positions = indices.map(k => self.getPosition(k));
      let t = [];
      if (this.joints) {
        const skinningWeights = indices.map(k => self.getSkinningWeights(k));
        const skinningIndices = indices.map(k => self.getSkinningIndices(k));
        positions.forEach((p, j) => {
          const pos = self.transformVertex(p, skinningWeights[j], skinningIndices[j]);
          t.push(pos);
        });
      } else {
        t = positions.map(p => self.transformVertex(p));
      }
      return t;
    }
    getWorldPosition(vertexIndex) {
      const position = this.getPosition(vertexIndex);
      if (this.joints) {
        const skinningWeights = this.getSkinningWeights(vertexIndex);
        const skinningIndices = this.getSkinningIndices(vertexIndex);
        return this.transformVertex(position, skinningWeights, skinningIndices);  
      }
      return this.transformVertex(position);
    }
    getPosition(vertexIndex) {
      const i = 3 * vertexIndex;
      return this.dataArrays.position.slice(i, i + 3);
    }
    getSkinningWeights(vertexIndex) {
      const i = 4 * vertexIndex;
      return this.dataArrays.boneWeights.slice(i, i + 4);
    }
    getSkinningIndices(vertexIndex) {
      const i = 4 * vertexIndex;
      return this.dataArrays.boneIndices.slice(i, i + 4);
    }
    getJointMatrix(jointIndex) {
      const i = jointIndex * 16; // 4x4 matrix
      return this.joints.slice(i, i + 16);
    }
    getLandmarkWorldPos(landmark) {
      const modelPos = this.positions[landmark].concat(1);
      const worldPos = VMath.mulColumnVector(this.transformMatrix, modelPos);
      return worldPos.slice(0, 3);
    }
    transformVertex(position, skinningWeights, skinningIndices) {
      const self = this;
      const p = position.concat(1); // [x, y, z, 1]
      let v = p;
      if (skinningIndices) {
        v = [0, 0, 0, 1];
        skinningIndices.forEach((index, i) => {
          const jointMatrix = self.getJointMatrix(index);
          const pj = VMath.mulVector(jointMatrix, p);
          const weight = skinningWeights[i];
          v = VMath.sum(VMath.mulScalar(pj, weight), v);
        });
        v[3] = 1;
      }
      const worldPos = VMath.mulColumnVector(this.transformMatrix, v);
      return worldPos.slice(0, 3);
    }
  }

  // Workers do not support module exports atm (but they will: https://stackoverflow.com/a/45578811)
  // For the time being, use old export trick so we can unit-test this without a Worker
  /* eslint-disable no-param-reassign */
  /* eslint-disable no-multi-assign */
  global.ModelDistance = (global.module || {}).exports = ModelDistance;
})(this);
