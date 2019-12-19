const LabelUtils = {
  // it copes with different Json formats
  importLabels(labelFile) {
    if (Array.isArray(labelFile)) {
      // format: [ {"name": "label-name", "position": [0.1, 1.17. -1]}, ...]
      const labels = {};
      labelFile.forEach((item) => {
        labels[item.name] = item.position;
      });
      return labels;
    }
    // format:
    // { "label-name": {"x": 0.1, "y": 1.17, "z": -1}, ...
    // or,
    // { "label-name": [0.1, 1.17, -1]}, ...
    return labelFile;
  },

  // AbdomenBack                        29.32800    818.24270   -126.33450
  importLabelsTxt(labelFile) {
    function getVector(match) {
      const v = [];
      match.slice(2, 5).forEach((val) => {
        v.push(parseFloat(val));
      });
      return v;
    }
    const crFreeText = labelFile.replace(/[\r]+/g, '');
    const lines = crFreeText.split('\n');
    const labels = {};
    lines.forEach((s) => {
      const m = /(\w+)\s+(-?\d+\.?\d+)\s+(-?\d+\.?\d+)\s+(-?\d+\.?\d+)/.exec(s);
      if (m) {
        labels[m[1]] = getVector(m);
      }
    });
    return labels;
  },

  // labels ending in one digit are merged into a single label,
  // its position being the average of them all
  averageSimilarLabels(labels) {
    const ids = Object.keys(labels);
    const newLabels = {};
    const counts = {};
    ids.forEach((id) => {
      const m = /(\w*[A-Za-z_]+)(\d*)/.exec(id);
      const newId = m[1];
      const pos = newLabels[newId];
      if (pos) {
        newLabels[newId] = pos.map((a, i) => a + labels[id][i]);
        counts[newId] += 1;
      } else {
        newLabels[newId] = labels[id].slice(0, 3);
        counts[newId] = 1;
      }
    });
    Object.keys(newLabels).forEach((id) => {
      newLabels[id] = newLabels[id].map(a => a / counts[id]);
    });
    return newLabels;
  },
};

export default LabelUtils;
