class WavefrontObj {
  static parse(data) {
    const lines = data.split('\n');
    const positions = [];
    const normals = [];
    const uvs = [];
    const meshes = [];
    const uniqueIndexTriplets = {};
    const model = {
      materials: {},
      stride: 8,
      vertices: [],
      meshes: [],
    };
    let lastGroup = -1;
    lines.forEach((s) => {
      let m;
      m = /mtllib\s(.*)/.exec(s);
      if (m) {
        [, model.materialFile] = m;
      }
      m = /v\s(.+)\s(.+)\s(.+)/.exec(s);
      if (m) {
        m.slice(1, 4).forEach((val) => {
          positions.push(parseFloat(val));
        });
        return;
      }
      m = /vn\s(.+)\s(.+)\s(.+)/.exec(s);
      if (m) {
        m.slice(1, 4).forEach((val) => {
          normals.push(parseFloat(val));
        });
        return;
      }
      m = /vt\s(.+)\s(.+)/.exec(s);
      if (m) {
        uvs.push(parseFloat(m[1]));
        uvs.push(parseFloat(m[2]));
        return;
      }
      m = /g\s(.*)/.exec(s);
      if (m) {
        meshes.push({ name: m[1], indices: [] });
        lastGroup += 1;
      }
      m = /usemap\s(.*)/.exec(s);
      if (m) {
        const material = { albedoMap: m[1] };
        model.materials[m[1]] = material;
        if (lastGroup >= 0) {
          [, meshes[lastGroup].material] = m;
        } else {
          meshes.push({ material: m[1], indices: [] });
        }
        return;
      }
      m = /usemtl\s(.*)/.exec(s);
      if (m) {
        if (lastGroup >= 0) {
          [, meshes[lastGroup].material] = m;
        } else {
          meshes.push({ material: m[1], indices: [] });
        }
        return;
      }
      m = /f\s(\d+(?:\/\d*){0,2})\s(\d+(?:\/\d*){0,2})\s(\d+(?:\/\d*){0,2})/.exec(s);
      if (m) {
        m.slice(1, 4).forEach((val) => {
          uniqueIndexTriplets[val] = (uniqueIndexTriplets[val] || 0) + 1;
          meshes[meshes.length - 1].indices.push(val);
        });
      }
    });
    let countSharedVertices = 0;
    const uniqueIndexKeys = Object.keys(uniqueIndexTriplets);
    let newVertexIndex = 0;
    uniqueIndexKeys.forEach((k) => {
      if (uniqueIndexTriplets[k] > 1) {
        countSharedVertices += 1;
      }
      uniqueIndexTriplets[k] = newVertexIndex;
      newVertexIndex += 1;
      const triplet = k.split('/').map(d => parseInt(d, 10) - 1);
      model.vertices.push(positions[3 * triplet[0]]);
      model.vertices.push(positions[3 * triplet[0] + 1]);
      model.vertices.push(positions[3 * triplet[0] + 2]);
      model.vertices.push(triplet[2] === undefined ? 0 : normals[3 * triplet[2]]);
      model.vertices.push(triplet[2] === undefined ? 0 : normals[3 * triplet[2] + 1]);
      model.vertices.push(triplet[2] === undefined ? 0 : normals[3 * triplet[2] + 2]);
      model.vertices.push(triplet[1] === undefined ? 0 : uvs[2 * triplet[1]]);
      model.vertices.push(triplet[1] === undefined ? 0 : uvs[2 * triplet[1] + 1]);
    });
    console.log(`# shared vertices: ${countSharedVertices}/${positions.length}`);
    meshes.forEach((m) => {
      const submesh = { material: m.material, indices: [] };
      // populate with new indices
      m.indices.forEach((i) => {
        submesh.indices.push(uniqueIndexTriplets[i]);
      });
      model.meshes.push(submesh);
    });
    return model;
  }

  static parseMaterial(data) {
    const lines = data.split('\n');
    const materials = {};
    let lastMaterial = '';
    function getVector(match) {
      const v = [];
      match.slice(1, 4).forEach((val) => {
        v.push(parseFloat(val));
      });
      return v;
    }
    lines.forEach((s) => {
      let m;
      m = /newmtl\s(.*)/.exec(s);
      if (m) {
        [, lastMaterial] = m;
        materials[lastMaterial] = {};
        return;
      }
      m = /Kd\s(.+)\s(.+)\s(.+)/.exec(s);
      if (m) {
        materials[lastMaterial].diffuseColor = getVector(m);
        return;
      }
      m = /Ka\s(.+)\s(.+)\s(.+)/.exec(s);
      if (m) {
        materials[lastMaterial].ambientColor = getVector(m);
        return;
      }
      m = /Ks\s(.+)\s(.+)\s(.+)/.exec(s);
      if (m) {
        materials[lastMaterial].specularColor = getVector(m);
        return;
      }
      m = /Ns\s(.+)/.exec(s);
      if (m) {
        materials[lastMaterial].specularExponent = parseFloat(m[1]);
        return;
      }
      m = /map_Kd\s(.*)/.exec(s);
      if (m) {
        [, materials[lastMaterial].albedoMap] = m;
        return;
      }
      m = /d\s(.+)/.exec(s);
      if (m) {
        materials[lastMaterial].opaqueness = parseFloat(m[1]);
      }
    });
    return materials;
  }

  static export(model, callback) {
    let out = '# Vertices\n';
    for (let i = 0; i < model.vertices.length; i += 8) {
      out += `v ${model.vertices[i]} ${model.vertices[i + 1]} ${model.vertices[i + 2]}\n`;
    }
    out += '# Normals\n';
    for (let i = 0; i < model.vertices.length; i += 8) {
      out += `vn ${model.vertices[i + 3]} ${model.vertices[i + 4]} ${model.vertices[i + 5]}\n`;
    }
    out += '# Texture coordinates\n';
    for (let i = 0; i < model.vertices.length; i += 8) {
      out += `vt ${model.vertices[i + 6]} ${model.vertices[i + 7]}\n`;
    }
    model.meshes.forEach((m) => {
      out += `usemap ${m.texture}\n`; // old Wavefront texture map
      for (let i = 0; i < m.indices.length; i += 3) {
        const i1 = m.indices[i] + 1;
        const i2 = m.indices[i + 1] + 1;
        const i3 = m.indices[i + 2] + 1;
        out += `f ${i1}/${i1}/${i1} `;
        out += `${i2}/${i2}/${i2} `;
        out += `${i3}/${i3}/${i3}\n`;
      }
    });
    callback(out);
  }
}
export { WavefrontObj as default };
