const ParseUtils = {
  // [..., "12", "-2.2", ...] -> [12, -2.2] 
  getVector(array, start, end) {
    const v = [];
    array.slice(start, end).forEach((val) => {
      v.push(parseFloat(val));
    });
    return v;
  },
  // [2, -0.1, 0.3] -> {"x": 2, "y": -0.1, "z": 0.3}
  vectorToObject(v) {
    return {"x": v[0], "y": v[1], "z": v[2]};
  },
  forEachLine(text, fn) {
    const crFreeText = text.replace(/[\r]+/g, '');
    const lines = crFreeText.split('\n');
    lines.forEach(fn);
  }
};

export default ParseUtils;