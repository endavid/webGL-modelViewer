import MovingBuffer from './movingBuffer.js';

function flip(buffer, width, height, o) {
  const flipped = new Uint8Array(buffer.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      for (let c = 0; c < 4; c += 1) {
        const i = y * width * 4 + x * 4 + c;
        const cs = o.shiftAlpha ? (c + 1) % 4 : c;
        const ys = o.flipY ? (height - y - 1) : y;
        const j = ys * width * 4 + x * 4 + cs;
        flipped[i] = buffer[j];
      }
    }
  }
  return flipped;
}

// https://en.wikipedia.org/wiki/Netpbm#PAM_graphics_format
class PamEncoder {
  constructor(uint8buffer, width, height, options) {
    this.options = options || {};
    this.width = width;
    this.height = height;
    let header = `P7\nWIDTH ${width}\nHEIGHT ${height}\nDEPTH 4\n`;
    header += 'MAXVAL 255\nTUPLTYPE RGB_ALPHA\nENDHDR\n';
    this.rawBuffer = new ArrayBuffer(header.length + uint8buffer.length);
    let mb = new MovingBuffer(new Uint8Array(this.rawBuffer));
    mb.writeString(header);
    this.buffer = new Uint8Array(this.rawBuffer, header.length, uint8buffer.length);
    mb = new MovingBuffer(this.buffer);
    if (this.options.flipY || this.options.shiftAlpha) {
      mb.writeBuffer(flip(uint8buffer, width, height, options));
    } else {
      mb.writeBuffer(uint8buffer);
    }
  }
}

export { PamEncoder as default };
