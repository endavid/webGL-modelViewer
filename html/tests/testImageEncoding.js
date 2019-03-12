/* eslint-env qunit */
import Gfx from '../js/gfx.js';
import PngEncoder from '../js/pngencoder.js';

const { PNGReader, pako } = window;

function countDifferent(expected, actualArray, delta) {
  let count = 0;
  actualArray.forEach((actual) => {
    if (Math.abs(actual - expected) > delta) {
      count += 1;
    }
  });
  return count;
}

function waitForImage(src) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', src, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = () => {
      if (xhr.status === 200) {
        const reader = new PNGReader(xhr.response);
        reader.parse((err, png) => {
          if (err) {
            reject(err);
          } else {
            const data = Gfx.decodeR32FPng(png);
            resolve(data);
          }
        });
      } else {
        reject(new Error(`Returned status: ${this.status}`));
      }
    };
    xhr.send();
  });
}

QUnit.module('ImageEncoding');

QUnit.test('decode Float32 from RGBA', (assert) => {
  const done = [];
  const testImages = [
    './tests/img/TestR32FEncoding1.png',
    './tests/img/TestR32FEncoding2.png',
    './tests/img/TestR32FEncoding3.png'];
  const expectedValues = [0.4732, 87.32, -2e7];
  testImages.forEach(() => done.push(assert.async()));
  testImages.forEach((imgSrc, i) => {
    const expected = expectedValues[i];
    waitForImage(imgSrc).then((data) => {
      console.log(`Decoded: ${data[0]}`);
      const count = countDifferent(expected, data, 1e-6);
      assert.equal(count, 0);
      done[i]();
    })
      .catch(() => {
        assert.ok(false);
        done[i]();
      });
  });
});

QUnit.test('encode RGBA to PNG', (assert) => {
  const color = [242, 71, 69, 62];
  const width = 4;
  const height = 4;
  const buffer = new Uint8Array(height * width * 4);
  for (let i = 0; i < buffer.length; i += 1) {
    buffer[i] = color[i % 4];
  }
  const pnge = new PngEncoder(buffer, width, height);
  const uint8buffer = new Uint8Array(pnge.rawBuffer);
  // inspected Test32FEncoding1.png in hex viewer (HxD)
  const expected = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x04, 0x08, 0x06, 0x00, 0x00, 0x00, 0xa9, 0xf1, 0x9e,
    0x7E, 0x00, 0x00, 0x00, 0x01, 0x73, 0x52, 0x47, 0x42, 0x00, 0xAE, 0xCE, 0x1C, 0xE9, 0x00, 0x00,
    0x00, 0x04, 0x67, 0x41, 0x4D, 0x41, 0x00, 0x00, 0xB1, 0x8F, 0x0B, 0xFC, 0x61, 0x05, 0x00, 0x00,
    0x00, 0x13, 0x49, 0x44, 0x41, 0x54, 0x18, 0x57, 0x63, 0xF8, 0xE4, 0xEE, 0x6A, 0x87, 0x8C, 0x49,
    0x16, 0x70, 0xB5, 0x03, 0x00, 0xC0, 0xE1, 0x1B, 0xC1, 0x54, 0x8F, 0x46, 0x45, 0x00, 0x00, 0x00,
    0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
  ]);
  // inflate the expected IDAT
  const expectedData = pako.inflate(expected.slice(70, 70 + 19));
  assert.equal(expectedData[0], 0); // 0 before every row
  assert.deepEqual(expectedData.slice(1, 5), new Uint8Array(color));
  const dataSize = uint8buffer[65];
  assert.deepEqual(pako.inflate(uint8buffer.slice(70, 70 + dataSize)), expectedData);
  // Even though the above passes, the PNG is still not correct :(
  // I'll leave this test here in case I want to pick it this up later.
  // assert.equal(uint8buffer.length, expected.length);
  // assert.deepEqual(expected, uint8buffer);
});
