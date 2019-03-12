/* eslint-disable no-plusplus */
/* eslint-disable no-bitwise */

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

export { MovingBuffer as default };
