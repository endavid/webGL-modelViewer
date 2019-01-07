(function(global) {
  "use strict";

  var VMath = {
    normalize: function(v) {
      var norm = v.reduce((acc, c) => acc + c * c, 0);
      norm = Math.sqrt(norm) || 1;
      return v.map(c => c / norm);
    },
    sum: (a, b) => {
      var out = [];
      a.forEach((v, i) => {
        out.push(v + b[i]);
      });
      return out;
    },
    diff: (a, b) => {
      var out = [];
      a.forEach((v, i) => {
        out.push(v - b[i]);
      });
      return out;
    },
    cross: (a, b) => {
      return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
      ];
    },
    hashVertex: (v) => {
      const ints = v.map(c => Math.round(100 * c));
      return ints.reduce((acc, c) => acc + "/" + c, "");
    }
  };
  class ModelData {
    constructor(json) {
      // shallow copy
      Object.assign(this, json);
      this.facesPerPosition = {};
    }
    stepFacesPerPositionCreation(i) {
      const num = this.numTriangles();
      const progress = {
        step: i,
        total: num,
        done: i === num
      };
      if (progress.done) {
        return progress;
      }
      var meshIndex = 0;
      var mesh = this.meshes[0];
      var n = mesh.indices.length / 3;
      while (i >= n) {
        i = i - n;
        meshIndex++;
        mesh = this.meshes[meshIndex];
        n = mesh.indices.length / 3;
      }
      var self = this;
      const vertexIndexToHash = vi => VMath.hashVertex(self.getPosition(vi));
      let t = mesh.indices.slice(3 * i, 3 * (i+1));
      const hashes = t.map(vertexIndexToHash);
      var fpp = this.facesPerPosition;
      hashes.forEach(h => {
        if (!fpp[h]) {
          fpp[h] = [];
        }
        fpp[h].push(t);
      });
      return progress;
    }
    numVertices() {
      return this.vertices.length / this.stride;
    }
    numTriangles() {
      var numTriangles = 0;
      this.meshes.forEach(m => {
        numTriangles += m.indices.length / 3;
      });
      return numTriangles;
    }
    getPosition(vertexIndex) {
      const i = vertexIndex * this.stride;
      return this.vertices.slice(i, i + 3);
    }
    getNormal(vertexIndex) {
      const i = vertexIndex * this.stride;
      return this.vertices.slice(i + 3, i + 6);
    }
    recomputeNormal(i) {
      const div = (divisor, v) => v / divisor;
      const n = this.numVertices();
      const progress = {
        step: i,
        total: n,
        done: i === n
      };
      if (progress.done) {
        return progress;
      }
      let j = i * this.stride;
      const position = this.getPosition(i);
      const hash = VMath.hashVertex(position);
      let triangleList = this.facesPerPosition[hash];
      let numContributingFaces = triangleList.length;
      if (numContributingFaces === 0) {
        return progress;
      }
      let faceNormals = triangleList.map(this.computeTriangleNormal.bind(this));
      let vectorSum = faceNormals.reduce(VMath.sum, [0, 0, 0]);
      let normalAverage = vectorSum.map(div.bind(null, numContributingFaces));
      this.vertices[j + 3] = normalAverage[0];
      this.vertices[j + 4] = normalAverage[1];
      this.vertices[j + 5] = normalAverage[2];
      return progress;
    }
    computeTriangleNormal(triangle) {
      const positions = triangle.map(this.getPosition.bind(this));
      const v1 = VMath.diff(positions[0], positions[1]);
      const v2 = VMath.diff(positions[0], positions[2]);
      return VMath.normalize(VMath.cross(v1, v2));
    }
  }
  // Workers do not support module exports atm (but they will: https://stackoverflow.com/a/45578811)
  // For the time being, use old export trick so we can unit-test this without a Worker
  global.ModelData = (global.module || {}).exports = ModelData;
})(this);