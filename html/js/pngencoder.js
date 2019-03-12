/* eslint-disable no-plusplus */
/* eslint-disable no-bitwise */
// I'm writing my own encoder because when using Canvas, the image
// gets color-corrected, which breaks the decoding of floats
// when packing them into RGBA images. I need to output the bytes
// as they are, without any transforms!
// Based on https://github.com/IjzerenHein/pnglib-es6/blob/master/src/pnglib-es6.js

const HEADER = '\x89PNG\r\n\x1A\n';

const { pako, base64js } = window;

// crc32 lookup table
const _crc32 = [];
function createCrc32LookupTable() {
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      if (c & 1) {
        c = -306674912 ^ ((c >> 1) & 0x7fffffff);
      } else {
        c = (c >> 1) & 0x7fffffff;
      }
    }
    _crc32[i] = c;
  }
}

class MovingBuffer {
  constructor(buffer) {
    this.buffer = buffer;
    this.offset = 0;
  }
  write4(value) {
    const o = this.offset;
    this.buffer[o] = (value >> 24) & 255;
    this.buffer[o + 1] = (value >> 16) & 255;
    this.buffer[o + 2] = (value >> 8) & 255;
    this.buffer[o + 3] = value & 255;
    this.offset += 4;
  }
  write2(value) {
    const o = this.offset;
    this.buffer[o] = (value >> 8) & 255;
    this.buffer[o + 1] = value & 255;
    this.offset += 2;
  }
  write2lsb(value) {
    const o = this.offset;
    this.buffer[o] = value & 255;
    this.buffer[o + 1] = (value >> 8) & 255;
    this.offset += 2;
  }
  write1(value) {
    this.buffer[this.offset] = value;
    this.offset += 1;
  }
  writeString(string) {
    let o = this.offset;
    for (let i = 0, n = string.length; i < n; i += 1) {
      this.buffer[o] = string.charCodeAt(i);
      o += 1;
    }
    this.offset = o;
  }
  writeBuffer(buffer) {
    const o = this.offset;
    for (let i = 0; i < buffer.length; i += 1) {
      this.buffer[o + i] = buffer[i];
    }
    this.offset += buffer.length;
  }
  // Compute crc32 of the PNG chunks.
  // The CRC is computed over the chunk type (4 bytes) and chunk data.
  crc32(size) {
    if (_crc32.length === 0) createCrc32LookupTable();
    const o = this.offset - size;
    let crc = -1;
    for (let i = 0; i < size; i += 1) {
      crc = _crc32[(crc ^ this.buffer[o + i]) & 0xff] ^ ((crc >> 8) & 0x00ffffff);
    }
    this.write4(crc ^ -1);
  }
}

function pushZeroesToEveryRow(buffer, width, height) {
  const padded = new Uint8Array(height * (width * 4 + 1));
  for (let i = 0, j = 0; i < padded.length; i += 1) {
    if (i % (width * 4 + 1) === 0) {
      // we need to start each row with a zero
      // (reverse-engineered through pako.inflate Test32FEncoding1.png IDAT)
      padded[i] = 0;
    } else {
      padded[i] = buffer[j];
      j += 1;
    }
  }
  return padded;
}

// RGBA images only
class PngEncoder {
  constructor(uint8buffer, width, height) {
    // https://en.wikipedia.org/wiki/Portable_Network_Graphics
    // http://www.libpng.org/pub/png/book/chapter11.html
    this.bitDepth = 32; // truecolor RBGA
    this.pixelFormat = 6; // RGBA
    this.compressionMethod = 0;
    this.filterMethod = 0;
    this.interlaceMethod = 0;

    const ihdrChunkSize = 13; // always 13 bytes. See doc.
    const srgbChunkSize = 1;
    const gammaChunkSize = 4;

    const paddedWithZeroes = pushZeroesToEveryRow(uint8buffer, width, height);
    // { level: 0 } means no compression -- default is level 6
    const compressed = pako.deflate(paddedWithZeroes, { level: 2 });
    const dataChunkSize = compressed.length;

    const numChunks = 5;
    const infoBytesPerChunk = 4 * 3; // length, chunk type, crc
    this.bufferSize = numChunks * infoBytesPerChunk
      + ihdrChunkSize + srgbChunkSize + gammaChunkSize + dataChunkSize;

    this.rawBuffer = new ArrayBuffer(HEADER.length + this.bufferSize);
    // write header
    let mb = new MovingBuffer(new Uint8Array(this.rawBuffer));
    mb.writeString(HEADER);
    const buffer = new Uint8Array(this.rawBuffer, HEADER.length, this.bufferSize);
    mb = new MovingBuffer(buffer);
    mb.write4(ihdrChunkSize);
    mb.writeString('IHDR');
    mb.write4(width);
    mb.write4(height);
    mb.write1(this.bitDepth);
    mb.write1(this.pixelFormat);
    mb.write1(this.compressionMethod);
    mb.write1(this.filterMethod);
    mb.write1(this.interlaceMethod);
    mb.crc32(ihdrChunkSize + 4);
    mb.write4(srgbChunkSize);
    mb.writeString('sRGB');
    mb.write1(0);
    mb.crc32(srgbChunkSize + 4);
    mb.write4(gammaChunkSize);
    mb.writeString('gAMA');
    mb.write4(0x0000b18f);
    mb.crc32(gammaChunkSize + 4);
    // write image data
    mb.write4(dataChunkSize);
    mb.writeString('IDAT');
    mb.writeBuffer(compressed);
    mb.crc32(dataChunkSize + 4);
    // end of image
    mb.write4(0); // no data for IEND marker
    mb.writeString('IEND');
    mb.crc32(4);
  }
  getBase64() {
    return base64js.fromByteArray(new Uint8Array(this.rawBuffer));
  }
  getDataURL() {
    return `data:image/png;base64,${this.getBase64()}`;
  }
}

export { PngEncoder as default };
