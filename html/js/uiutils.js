import $ from './jquery.module.js';

const UiUtils = {
  createSlider(id, text, value, min, max, step, callback) {
    return UiUtils.createMultiSlider(id, [''], text, [value], min, max, step, callback);
  },
  createMultiSlider(id, subIds, text, values, min, max, step, callback) {
    const controls = [];
    let sliderClass;
    if (subIds.length > 1) {
      sliderClass = 'three';
    }
    subIds.forEach((sub, i) => {
      const sliderId = id + sub;
      const numberId = `${sliderId}_number`;
      const value = values[i];
      const sliderUpdateFunction = (event) => {
        $(`#${numberId}`).val(event.target.value);
        callback(event.target.value, sub);
      };
      const numberUpdateFunction = (event) => {
        $(`#${sliderId}`).val(event.target.value);
        callback(event.target.value, sub);
      };
      const numberInput = $('<input>')
        .attr('id', numberId)
        .attr('type', 'number')
        .attr('value', value)
        .attr('class', 'range')
        .change(numberUpdateFunction);
      const sliderInput = $('<input>')
        .attr('id', sliderId)
        .attr('type', 'range')
        .attr('min', min)
        .attr('max', max)
        .attr('step', step)
        .attr('value', value)
        .on('input', sliderUpdateFunction)
        .change(sliderUpdateFunction);
      if (sliderClass) {
        sliderInput.attr('class', sliderClass);
      }
      controls.push(numberInput);
      controls.push(sliderInput);
    });
    const td = $('<td>').append(`${text}: <br/>`);
    controls.forEach((c) => { td.append(c); });
    return $('<tr>').attr('id', `${id}_parent`).append(td);
  },
  createCheckbox(id, text, checked, callback) {
    const config = {};
    config[id] = { text, default: checked };
    return UiUtils.createCheckboxes(id, config, (_key, value) => {
      callback(value);
    });
  },
  createCheckboxes(id, config, callback) {
    const keys = Object.keys(config);
    const td = $('<td>');
    keys.forEach((key) => {
      const updateFn = event => callback(key, event.target.checked);
      td.append(`${config[key].text}: `)
        .append($('<input>')
          .attr('id', key)
          .attr('type', 'checkbox')
          .prop('checked', config[key].default)
          .change(updateFn));
    });
    return $('<tr>').attr('id', `${id}_parent`).append(td);
  },
  createDropdownList(id, list, callback) {
    const updateFunction = (event) => {
      const i = event.target.selectedIndex;
      const obj = { name: event.target.options[i].innerHTML, uri: event.target.value };
      callback(obj);
    };
    const select = $('<select>').attr('id', id).change(updateFunction);
    list.forEach((obj) => {
      select.append($('<option>').attr('value', obj.value).append(obj.name));
    });
    return $('<tr>').attr('id', `${id}_parent`).append($('<td>')
      .append(`${id}: `).append(select));
  },
  addUrisToDropdownList(id, list) {
    const select = $(`#${id}`);
    list.forEach((obj) => {
      const option = $('<option>')
        .attr('value', obj.uri)
        .attr('selected', true)
        .append(obj.name);
      select.append(option);
    });
  },
  createButton(id, text, callback) {
    return $('<tr>').attr('id', `${id}_parent`).append($('<td>')
      .append($('<button>')
        .attr('id', id)
        .attr('type', 'button')
        .click(callback)
        .append(text)));
  },
  createButtonWithOptions(id, buttonText, midText, options, callback) {
    let select = null;
    if (Array.isArray(options)) {
      select = $('<select>').attr('id', `${id}_select`);
      options.forEach((obj) => {
        select.append($('<option>').attr('value', obj.value).append(obj.name));
      });
    } else {
      select = options;
    }
    return $('<tr>').attr('id', `${id}_parent`).append($('<td>')
      .append($('<button>')
        .attr('id', id)
        .attr('type', 'button')
        .click(callback)
        .append(buttonText))
      .append(midText)
      .append(select));
  },
  createTitle(id, text, cssclass) {
    return $('<tr>').attr('id', id).append($('<td>').attr('class', cssclass || 'selected').append(text));
  },
  createFileBrowser(id, text, multiple, callback) {
    const updateFunction = (event) => {
      const fileArray = [];
      for (let i = 0; i < event.target.files.length; i += 1) {
        const f = event.target.files[i];
        fileArray.push({
          name: f.name,
          uri: URL.createObjectURL(f),
        });
      }
      callback(fileArray);
    };
    return $('<tr>').attr('id', `${id}_parent`).append($('<td>')
      .append(`${text}: <br/>`)
      .append($('<input>')
        .attr('id', id)
        .attr('type', 'file')
        // .obj, .json doesn't work in Safari...
        // .attr('accept', '.obj,.json,.dae,.mtl,image/*')
        .attr('multiple', multiple ? '' : false)
        .change(updateFunction)));
  },
  createSubGroup(id, text, elements, parent) {
    return UiUtils.createGroup(id, text, elements, 'subgroup', parent);
  },

  createGroup(id, text, elements, cssclass, parent) {
    const elementIds = [];
    elements.forEach((element) => {
      // *_parent ids
      elementIds.push(element.attr('id'));
    });
    const toggle = () => {
      if (elementIds.length > 0) {
        // based on the first element so subgroups are collapsed as well
        const hidden = $(`#${elementIds[0]}`).is(':hidden');
        const delay = 0;
        elementIds.forEach((elementId) => {
          if (hidden) {
            const p = $(`#${elementId}`).attr('parent');
            if (!p || p === id) {
              $(`#${elementId}`).show(delay);
            }
          } else {
            $(`#${elementId}`).hide(delay);
          }
        });
      }
    };
    const title = UiUtils.createTitle(id, text, cssclass).click(toggle);
    if (parent) {
      title.attr('parent', parent);
    }
    return [title].concat(elements);
  },

  addGroup(id, text, elements, parent) {
    const group = UiUtils.createGroup(id, text, elements);
    UiUtils.addToTable(group, parent);
  },

  addToTable(group, parent) {
    const tbody = $(parent || '#controls').find('tbody');
    group.forEach((element) => {
      tbody.append(element);
    });
  },
};
export { UiUtils as default };
