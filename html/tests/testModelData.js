QUnit.module("ModelData");

QUnit.test("Model Data", assert => {
  const json = {
    name: "tiny test",
    materials: {},
    vertices: [
      1, 0, 0, 1, 0, 0, 0, 0,
      0, 1, 0, 0, 1, 0, 0, 0,
      0, 0, 1, 0, 0, 1, 0, 0,
      -1, 0, 0, -1, 0, 0, 0, 0,      
      0, -1, 0, 0, -1, 0, 0, 0,
      0, 0, -1, 0, 0, -1, 0, 0,
    ],
    stride: 8,
    meshes: [{
      indices: [
        0, 1, 2,
        0, 1, 3,
        1, 2, 3,
        1, 2, 4,
        3, 4, 5,
        2, 4, 5
      ]
    }]
  };
  const modelData = new ModelData(json);
  assert.deepEqual(modelData.getNormal(2), [0, 0, 1]);
  var progress = {step: -1, done: false};
  while (!progress.done) {
    progress = modelData.stepFacesPerPositionCreation(progress.step + 1);
  }
  modelData.recomputeNormal(2);
  assert.deepEqual(modelData.getNormal(2), [0.7886751345948129, 0, 0]);
});