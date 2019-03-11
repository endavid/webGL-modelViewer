/* eslint-env qunit */
import Gfx from '../js/gfx.js';

const { PNGReader } = window;

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
