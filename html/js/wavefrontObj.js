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
      dataArrays: {
        position: [],
        normal: [],
        uv: [],
      },
      meshes: [],
    };
    let lastGroup = -1;
    let currentMaterial = 'unknown';
    const storeFn = (val) => {
      uniqueIndexTriplets[val] = (uniqueIndexTriplets[val] || 0) + 1;
      meshes[meshes.length - 1].indices.push(val);
    };
    lines.forEach((s) => {
      if (s.startsWith('#')) {
        // comments
        return;
      }
      // the filter is to remove potential extra white spaces
      // https://stackoverflow.com/a/64942185
      const m = s.split(' ').filter(Boolean);
      if (m.length === 0) {
        // empty line?
        return;
      }
      const cmd = m[0];
      switch (cmd) {
        case 'mtllib':
          [, model.materialFile] = m;
          break;
        case 'v':
          m.slice(1, 4).forEach((val) => {
            positions.push(parseFloat(val));
          });
          // right now, vertex color is not supported
          // so ignore the RGB values if there are 3 extra numbers at the end
          break;
        case 'vn':
          m.slice(1, 4).forEach((val) => {
            normals.push(parseFloat(val));
          });
          break;
        case 'vt':
          uvs.push(parseFloat(m[1]));
          uvs.push(parseFloat(m[2]));
          break;
        case 'g':
          meshes.push({ name: m[1], indices: [], material: currentMaterial });
          lastGroup += 1;
          break;
        case 'usemap':
          model.materials[m[1]] = { albedoMap: m[1] };
          [, currentMaterial] = m;
          break;
        case 'usemtl':
          [, currentMaterial] = m;
          if (lastGroup >= 0) {
            meshes[lastGroup].material = currentMaterial;
          }
          break;
        case 'f':
          if (meshes.length === 0) {
            // file with no 'g', so create a default mesh
            meshes.push({ name: 'unknown', indices: [], material: currentMaterial });
          }
          m.slice(1, 4).forEach(storeFn);
          // support for quads
          if (m.length > 4) {
            const indices = [1, 3, 4];
            indices.forEach((i) => {
              storeFn(m[i]);
            });
          }
          break;
        default:
          console.warn(`Unknown Wavefront cmd: ${cmd}`);
      }
    });
    model.missingUVs = uvs.length === 0;
    model.missingNormals = normals.length === 0;
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
      model.dataArrays.position.push(positions[3 * triplet[0]]);
      model.dataArrays.position.push(positions[3 * triplet[0] + 1]);
      model.dataArrays.position.push(positions[3 * triplet[0] + 2]);
      if (!model.missingNormals) {
        model.dataArrays.normal.push(normals[3 * triplet[2]]);
        model.dataArrays.normal.push(normals[3 * triplet[2] + 1]);
        model.dataArrays.normal.push(normals[3 * triplet[2] + 2]);
      }
      if (!model.missingUVs) {
        model.dataArrays.uv.push(uvs[2 * triplet[1]]);
        model.dataArrays.uv.push(uvs[2 * triplet[1] + 1]);
      }
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
      if (s.startsWith('#')) {
        // comments
        return;
      }
      let m;
      m = /^newmtl\s(.*)/.exec(s);
      if (m) {
        [, lastMaterial] = m;
        materials[lastMaterial] = {};
        return;
      }
      m = /^Kd\s(.+)\s(.+)\s(.+)/.exec(s);
      if (m) {
        materials[lastMaterial].diffuseColor = getVector(m);
        return;
      }
      m = /^Ka\s(.+)\s(.+)\s(.+)/.exec(s);
      if (m) {
        materials[lastMaterial].ambientColor = getVector(m);
        return;
      }
      m = /^Ks\s(.+)\s(.+)\s(.+)/.exec(s);
      if (m) {
        materials[lastMaterial].specularColor = getVector(m);
        return;
      }
      m = /^Ns\s(.+)/.exec(s);
      if (m) {
        materials[lastMaterial].specularExponent = parseFloat(m[1]);
        return;
      }
      m = /^map_Kd\s(.*)/.exec(s);
      if (m) {
        [, materials[lastMaterial].albedoMap] = m;
        return;
      }
      m = /^d\s(.+)/.exec(s);
      if (m) {
        materials[lastMaterial].opaqueness = parseFloat(m[1]);
      }
    });
    return materials;
  }

  static export(model, submeshes, callback) {
    let out = '# Vertices\n';
    const { position, normal, uv } = model.dataArrays;
    for (let i = 0; i < position.length; i += 3) {
      out += `v ${position[i]} ${position[i + 1]} ${position[i + 2]}\n`;
    }
    out += '# Normals\n';
    for (let i = 0; i < normal.length; i += 3) {
      out += `vn ${normal[i]} ${normal[i + 1]} ${normal[i + 2]}\n`;
    }
    out += '# Texture coordinates\n';
    for (let i = 0; i < uv.length; i += 2) {
      out += `vt ${uv[i]} ${uv[i + 1]}\n`;
    }
    let meshesToExport = model.meshes;
    if (Array.isArray(submeshes)) {
      meshesToExport = model.meshes.filter(m => submeshes.indexOf(m.material) >= 0);
    }
    meshesToExport.forEach((m) => {
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
