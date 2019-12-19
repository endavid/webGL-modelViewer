const ParseUtils = {
  getVector(array, start, end) {
    const v = [];
    array.slice(start, end).forEach((val) => {
      v.push(parseFloat(val));
    });
    return v;
  },
  forEachLine(text, fn) {
    const crFreeText = text.replace(/[\r]+/g, '');
    const lines = crFreeText.split('\n');
    lines.forEach(fn);
  }
};

export default ParseUtils;