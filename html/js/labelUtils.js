import ParseUtils from './parseUtils.js';
// failed to import as a module atm
const { X2JS } = window;

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
    const labels = {};
    ParseUtils.forEachLine(labelFile, (s) => {
      const m = /(\w+)\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/.exec(s);
      if (m) {
        labels[m[1]] = ParseUtils.getVector(m, 2, 5);
      }
    });
    return labels;
  },

  //   4   0      0      1  -14.5168   104.853  0.477324 AbdomenRight
  importLabelsLnd(labelFile) {
    const labels = {};
    ParseUtils.forEachLine(labelFile, (s) => {
      const m = /\s*(\d+)\s+(-?\d+)\s+(-?\d)\s+(-?\d+)\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+(\w+)/.exec(s);
      if (m && m[4] === "1") {
        labels[m[8]] = ParseUtils.getVector(m, 5, 8);
      }
    });
    return labels;
  },

  // picked_points.pp file from MeshLab
  // <point active="1" x="73.6771" y="1609.75" z="107.05" name="sellion"/>
  importLabelsXml(labelFile) {
    const x2js = new X2JS();
    const json = x2js.xml_str2json(labelFile);
    if (!json) {
      throw new Error("Unable to parse XML file")
    }
    const labels = {};
    const { point } = json.PickedPoints;
    point.forEach((p) => {
      if (p._active === "1") {
        labels[p._name] = [p._x, p._y, p._z];
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
