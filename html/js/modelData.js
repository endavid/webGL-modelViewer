var MATH = {
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
    const n = this.numVertices();
    if (i === n) {
      return 100;
    }
    const position = this.getPosition(i);
    const hash = MATH.hashVertex(position);
    this.facesPerPosition[hash] = this.getTrianglesThatContainVertex(i, hash);
    return Math.round(100 * i / n);
  }
  numVertices() {
    return this.vertices.length / this.stride;
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
    if (i === n) {
      return 100;
    }
    const progress = Math.round(100 * i / n);
    let j = i * this.stride;
    const position = this.getPosition(i);
    const hash = MATH.hashVertex(position);
    let triangleList = this.getTrianglesThatContainVertex(i, hash);
    let numContributingFaces = triangleList.length;
    if (numContributingFaces === 0) {
      return progress;
    }
    let faceNormals = triangleList.map(this.computeTriangleNormal.bind(this));
    let vectorSum = faceNormals.reduce(MATH.sum, [0, 0, 0]);
    let normalAverage = vectorSum.map(div.bind(null, numContributingFaces));
    this.vertices[j + 3] = normalAverage[0];
    this.vertices[j + 4] = normalAverage[1];
    this.vertices[j + 5] = normalAverage[2];
    return progress;
  }
  getTrianglesThatContainVertex(vertexIndex, hash) {
    var self = this;
    const equal = vi => vi === vertexIndex;
    const equalHash = h => h === hash;
    const vertexIndexToHash = vi => MATH.hashVertex(self.getPosition(vi));
    var triangleList = [];
    this.meshes.forEach(m => {
      const numTriangles = m.indices.length / 3;
      for (let i = 0; i < numTriangles; i++) {
        let t = m.indices.slice(3 * i, 3 * (i+1));
        if (t.findIndex(equal) >= 0) {
          triangleList.push(t);
        } else if (hash) {
          const hashes = t.map(vertexIndexToHash);
          if (hashes.findIndex(equalHash) >= 0) {
            triangleList.push(t);
          }
        }
      }
    });
    return triangleList;
  }
  computeTriangleNormal(triangle) {
    const positions = triangle.map(this.getPosition.bind(this));
    const v1 = MATH.diff(positions[0], positions[1]);
    const v2 = MATH.diff(positions[0], positions[2]);
    return MATH.normalize(MATH.cross(v1, v2));
  }
}
