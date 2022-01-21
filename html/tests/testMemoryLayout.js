/* eslint-env qunit */
import MemoryLayout from '../js/memoryLayout.js';

QUnit.module('MemoryLayout');

function repeating(n, value) {
  return Array.apply(null, Array(n)).map(() => value);
}

QUnit.test('default vertex layout', (assert) => {
  const layout = MemoryLayout.defaultVertexLayout();
  assert.equal(layout.bytesPerLine, 36);
  assert.deepEqual(layout.memoryLineDescriptor, [
    {name: "position", count: 3, type: "float32"},
    {name: "normal", count: 3, type: "float32"},
    {name: "uv", count: 2, type: "float32"},
    {name: "color", count: 4, type: "uint8"}
  ]);
  assert.deepEqual(layout.byteOffsets, {
    position: 0,
    normal: 12,
    uv: 24,
    color: 32
  });
  assert.deepEqual(layout.counts, {
    position: 3,
    normal: 3,
    uv: 2,
    color: 4
  });
});

QUnit.test('interleave data', (assert) => {
  const dataArrays = {
    position: [
      1, 0, 0,
      0, 1, 0,
      0, 0, 1,
      -1, 0, 0,
      0, -1, 0,
      0, 0, -1,
    ],
    normal: [
      1, 0, 0,
      0, 1, 0,
      0, 0, 1,
      -1, 0, 0,
      0, -1, 0,
      0, 0, -1,  
    ],
    uv: [],
    // leaving 'color' out on purpose. It should add 0s by default
  };
  const layout = MemoryLayout.defaultVertexLayout();
  const buffer = layout.createInterleavedArrayBufferFromDataArrays(dataArrays);
  const stride = layout.bytesPerLine;
  const offsets = layout.byteOffsets;
  let dv = new DataView(buffer);
  let positionArray = [];
  let normalArray = [];
  let uvArray = [];
  let colorArray = [];
  let vertexCount = dataArrays.position.length / 3;
  for(let i = 0, k = 0; i < vertexCount; i++, k += stride) {
    for (let j = 0; j < 3; j++) {
      const columnOffset = 4 * j;
      positionArray.push(dv.getFloat32(k + offsets.position + columnOffset, true));
      normalArray.push(dv.getFloat32(k + offsets.normal + columnOffset, true));
    }
    for (let j = 0; j < 2; j++) {
      const columnOffset = 4 * j;
      uvArray.push(dv.getFloat32(k + offsets.uv + columnOffset, true));
    }
    for (let j = 0; j < 4; j++) {
      colorArray.push(dv.getUint8(k + offsets.color + j));
    }
  }
  assert.deepEqual(positionArray, dataArrays.position);
  assert.deepEqual(normalArray, dataArrays.normal);
  assert.deepEqual(uvArray, repeating(vertexCount * 2, 0));
  assert.deepEqual(colorArray, repeating(vertexCount * 4, 0));
});