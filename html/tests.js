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
  // https://api.qunitjs.com/assert/deepEqual
  assert.deepEqual(mv, [6, 3, 3, 19]);
  var mvt = MATH.mulVector(MATH.transpose(m), v);
  assert.deepEqual(mvt, [-3, 5, 14, 12]);
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
  assert.deepEqual(mm, expected);
  var mt = MATH.transpose(m);
  var mmt = MATH.mulMatrix(mt, mt);
  expected = MATH.transpose(expected);
  assert.deepEqual(mmt, expected);
});
