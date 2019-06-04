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
