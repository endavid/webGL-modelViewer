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
  createAngleSliders(id, parentId, values, callback) {
    const slider = UiUtils.createMultiSlider(
      `${id}_angle`,
      ['x', 'y', 'z'],
      'rotation XYZ',
      values, -180, 180, 0.1,
      callback,
    );
    if (parentId) {
      slider.attr('parent', parentId);
    }
    return slider;
  },
  createTranslationSliders(id, parentId, values, callback) {
    const slider = UiUtils.createMultiSlider(
      `${id}_translation`,
      ['x', 'y', 'z'],
      'translation XYZ',
      values, -10, 10, 0.1,
      callback,
    );
    if (parentId) {
      slider.attr('parent', parentId);
    }
    return slider;
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
      const obj = { name: event.target.options[i].innerHTML, value: event.target.value };
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
      const val = obj.uri || obj;
      const name = obj.name || obj;
      const option = $('<option>')
        .attr('value', val)
        .attr('selected', true)
        .append(name);
      select.append(option);
    });
  },
  createEmptyRow(id) {
    return $('<tr>').attr('id', `${id}_parent`)
      .append($('<td>').attr('id', id));
  },
  createButtons(id, list) {
    const td = $('<td>');
    list.forEach((b) => {
      let type='text';
      let content = b.text;
      if (b.icon) {
        type = 'icon';
        content = $('<img>')
          .attr('class', 'icon')
          .attr('type', b.iconType)
          .attr('alt', b.text)
          .attr('src', b.icon);
      }
      td.append($('<div>')
        .attr('id', b.id)
        .attr('class', 'button')
        .attr('type', type)
        .click(b.callback)
        .append(content));
    });
    return $('<tr>').attr('id', id).append(td);
  },
  createButton(id, text, callback) {
    return UiUtils.createButtons(`${id}_parent`, [{ id, text, callback }]);
  },
  createButtonWithOptions(id, buttonText, midText, options, callback, onChange) {
    let select = null;
    if (Array.isArray(options)) {
      select = $('<select>').attr('id', `${id}_select`);
      options.forEach((obj) => {
        select.append($('<option>').attr('value', obj.value).append(obj.name));
      });
      if (onChange) {
        select.change(onChange);
      }
    } else {
      select = options;
    }
    return $('<tr>').attr('id', `${id}_parent`).append($('<td>')
      .append($('<div>')
        .attr('id', id)
        .attr('class', 'button')
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

  createColorPicker(id, text, value, callback) {
    const colorPicker = $('<input>')
      .attr('id', id)
      .attr('type', 'color')
      .val(value)
      .change(callback);
    const td = $('<td>')
      .append(colorPicker)
      .append(` ${text}`);
    return $('<tr>').attr('id', `${id}_parent`).append(td);
  },

  createTextInput(id, text, value, callback) {
    const textInput = $('<input>')
      .attr('id', id)
      .attr('type', 'text')
      .val(value)
      .change(callback);
    const td = $('<td>')
      .append(`${text}: `)
      .append(textInput);
    return $('<tr>').attr('id', `${id}_parent`).append(td);
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

  addGroup(id, text, elements, parent, prepend) {
    const group = UiUtils.createGroup(id, text, elements);
    if (prepend) {
      UiUtils.prependToTable(group, parent);
    } else {
      UiUtils.appendToTable(group, parent);
    }
  },

  appendToTable(group, parent) {
    const tbody = $(parent || '#controls').find('tbody');
    group.forEach((element) => {
      tbody.append(element);
    });
  },

  prependToTable(group, parent) {
    const tbody = $(parent || '#controls').find('tbody');
    group.reverse().forEach((element) => {
      tbody.prepend(element);
    });
  },

};
export { UiUtils as default };
