const MemoryLayoutTypes = {
  float32: Float32Array.BYTES_PER_ELEMENT,
  uint8: Uint8Array.BYTES_PER_ELEMENT,
};

function getBytesPerLine(layout) {
  const fn = (previous, current) => previous + current.count * MemoryLayoutTypes[current.type];
  return layout.reduce(fn, 0);
}
function getByteOffset(name, layout) {
  let offset = 0;
  for (let i = 0; i < layout.length; i += 1) {
    const dataType = layout[i];
    if (dataType.name === name) {
      return offset;
    }
    offset += MemoryLayoutTypes[dataType.type] * dataType.count;
  }
  return offset;
}

class MemoryLayout {
  // E.g. [{name: 'position', count: 3, type: 'float32'}]
  constructor(memoryLineDescriptor) {
    this.memoryLineDescriptor = memoryLineDescriptor;
    this.bytesPerLine = getBytesPerLine(memoryLineDescriptor);
    const byteOffsets = {};
    const counts = {};
    memoryLineDescriptor.forEach((t) => {
      byteOffsets[t.name] = getByteOffset(t.name, memoryLineDescriptor);
      counts[t.name] = t.count;
    });
    this.byteOffsets = byteOffsets;
    this.counts = counts;
  }
  static defaultVertexLayout() {
    return new MemoryLayout([
      { name: 'position', count: 3, type: 'float32' },
      { name: 'normal', count: 3, type: 'float32' },
      { name: 'uv', count: 2, type: 'float32' },
      { name: 'color', count: 4, type: 'uint8' },
    ]);
  }
  static skinnedVertexLayout() {
    const layout = MemoryLayout.defaultVertexLayout().memoryLineDescriptor;
    return new MemoryLayout(layout.concat([
      // the object Id could be a byte, but the stride needs to be a multiple of 4!
      // and there's no INT type in WebGL for vertexAttribPointer
      // https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/vertexAttribPointer
      { name: 'objectId', count: 1, type: 'float32' },
      { name: 'boneWeights', count: 4, type: 'float32' },
      { name: 'boneIndices', count: 4, type: 'uint8' },
    ]));
  }
  static coloredVertexLayout() {
    return new MemoryLayout([
      { name: 'position', count: 3, type: 'float32' },
      { name: 'color', count: 4, type: 'uint8' },
    ]);
  }
  static skinnedColoredVertexLayout() {
    const layout = MemoryLayout.coloredVertexLayout().memoryLineDescriptor;
    return new MemoryLayout(layout.concat([
      { name: 'boneWeights', count: 4, type: 'float32' },
      { name: 'boneIndices', count: 4, type: 'uint8' },
    ]));
  }
  createInterleavedArrayBufferFromDataArrays(namedArrays) {
    // assume 'position' is always present
    const vertexCount = namedArrays.position.length / 3;
    // ref. https://www.html5rocks.com/en/tutorials/webgl/typed_arrays/
    const arrayBuffer = new ArrayBuffer(this.bytesPerLine * vertexCount);
    const dv = new DataView(arrayBuffer);
    let offset = 0;
    for (let i = 0; i < vertexCount; i += 1) {
      for (let j = 0; j < this.memoryLineDescriptor.length; j += 1) {
        const dataType = this.memoryLineDescriptor[j];
        const array = namedArrays[dataType.name] || [];
        for (let k = 0; k < dataType.count; k += 1) {
          const index = dataType.count * i + k;
          const value = index < array.length ? array[index] : 0;
          switch (dataType.type) {
            case 'float32':
              dv.setFloat32(offset, value, true);
              break;
            case 'uint8':
              dv.setUint8(offset, value);
              break;
            default:
              break;
          }
          offset += MemoryLayoutTypes[dataType.type];
        }
      }
    }
    return arrayBuffer;
  }
}

export default MemoryLayout;
