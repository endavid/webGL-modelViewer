function compareArrays(v0, v1) {
  if (v0.length !== v1.length) {
    return false;
  }
  for (var i = 0; i < v0.length; i++) {
    if (v0[i] !== v1[i]) {
      return false;
    }
  }
  return true;
}

QUnit.test( "matrix × vector", function( assert ) {
  // row-major
  var m = [
    1, 0, 0, -1,
    1, 0, 0, 1,
    1, 1, 1, 2,
    0, 0, 0, 3
  ];
  var v = [1, 2, 3, 4];
  var mv = MATH.mulVector(m, v);
  assert.ok( compareArrays([6, 3, 3, 19], mv), "Passed!" );
  var mvt = MATH.mulVector(MATH.transpose(m), v);
  assert.ok( compareArrays([-3, 5, 14, 12], mvt), "Passed!" );
});

QUnit.test( "matrix × matrix", function( assert ) {
  // row-major
  var m = [
    1, 0, 0, -1,
    1, 0, 0, 1,
    1, 1, 1, 2,
    0, 0, 0, 3
  ];
  var mm = MATH.mulMatrix(m, m);
  var expected = [1, 0, 0, -4, 1, 0, 0, 2, 3, 1, 1, 8, 0, 0, 0, 9];
  assert.ok( compareArrays(expected, mm), "Passed!" );
  var mt = MATH.transpose(m);
  var mmt = MATH.mulMatrix(mt, mt);
  expected = MATH.transpose(expected);
  assert.ok( compareArrays(expected, mmt), "Passed!" );
});
