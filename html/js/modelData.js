import MATH from './math.js';

class ModelData {
  constructor(json) {
    // shallow copy
    Object.assign(this, json);
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
  recomputeNormals() {
    const div = (divisor, v) => v / divisor;
    const n = this.numVertices();
    for (let i = 0; i < n; i++) {
      let j = i * this.stride;
      let triangleList = this.getTrianglesThatContainVertex(i);
      let numContributingFaces = triangleList.length;
      if (numContributingFaces === 0) {
        continue;
      }
      let faceNormals = triangleList.map(this.computeTriangleNormal.bind(this));
      let vectorSum = faceNormals.reduce(MATH.sum, [0, 0, 0]);
      let normalAverage = vectorSum.map(div.bind(null, numContributingFaces));
      this.vertices[j + 3] = normalAverage[0];
      this.vertices[j + 4] = normalAverage[1];
      this.vertices[j + 5] = normalAverage[2];
    }
  }
  getTrianglesThatContainVertex(vertexIndex) {
    const equal = v => v === vertexIndex;
    var triangleList = [];
    this.meshes.forEach(m => {
      const numTriangles = m.indices.length / 3;
      for (let i = 0; i < numTriangles; i++) {
        let t = m.indices.slice(3 * i, 3 * (i+1));
        if (t.findIndex(equal) >= 0) {
          triangleList.push(t);
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
export {ModelData as default};