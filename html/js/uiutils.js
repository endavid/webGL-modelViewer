const UiUtils = {
  createSlider: (id, text, value, min, max, step, callback) => {
    return UiUtils.createMultiSlider(id, [""], text, [value], min, max, step, callback);
  },
  createMultiSlider: (id, subIds, text, values, min, max, step, callback) => {
    var controls = [];
    var sliderClass;
    if (subIds.length > 1) {
      sliderClass = "three";
    }
    subIds.forEach(function(sub, i) {
      var sliderId = id + sub;
      var numberId = sliderId + "_number";
      var value = values[i];
      var sliderUpdateFunction = function(event) {
        $("#"+numberId).val(event.target.value);
        callback(event.target.value, sub);
      };
      var numberUpdateFunction = function(event) {
        $("#"+sliderId).val(event.target.value);
        callback(event.target.value, sub);
      };
      var numberInput = $('<input>')
        .attr('id', numberId)
        .attr('type', 'number')
        .attr('value', value)
        .attr('class', "range")
        .change(numberUpdateFunction);
      var sliderInput = $('<input>')
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
    var td = $('<td>').append(text+": <br/>");
    controls.forEach(function(c) {td.append(c);});
    return $('<tr>').attr('id',id+"_parent").append(td);
  },
  createCheckbox: (id, text, checked, callback) => {
    var config = {};
    config[id] = {text: text, default: checked};
    return UiUtils.createCheckboxes(id, config, (key, value) => {
      callback(value);
    });
  },
  createCheckboxes: (id, config, callback) => {
    const keys = Object.keys(config);
    var td = $('<td>');
    keys.forEach(key => {
      var updateFn = event => callback(key, event.target.checked);
      td.append(config[key].text+": ")
      .append($('<input>')
        .attr('id', key)
        .attr('type', "checkbox")
        .prop('checked', config[key].default)
        .change(updateFn));
    });
    return $('<tr>').attr('id',id+"_parent").append(td);
  },
  createDropdownList: (id, list, callback) => {
    var updateFunction = function(event) {
      var i = event.target.selectedIndex;
      var obj = {name: event.target.options[i].innerHTML, uri: event.target.value};
      callback(obj);
    };
    var select = $('<select>').attr('id', id).change(updateFunction);
    list.forEach(function (obj) {
      select.append($('<option>').attr('value', obj.value).append(obj.name));
    });
    return $('<tr>').attr('id',id+"_parent").append($('<td>')
            .append(id+": ").append(select));
  },
  addUrisToDropdownList: (id, list) => {
    var select = $('#'+id);
    list.forEach(function (obj) {
      const option = $('<option>')
        .attr('value', obj.uri)
        .attr('selected', true)
        .append(obj.name);
      select.append(option);
    });
  },
  createButton: (id, text, callback) => {
    return $('<tr>').attr('id',id+"_parent").append($('<td>')
            .append($("<button>")
              .attr('id', id)
              .attr('type', "button")
              .click(callback)
              .append(text))
            );
  },
  createButtonWithOptions: (id, buttonText, midText, options, callback) => {
    var select = null;
    if (Array.isArray(options)) {
      select = $('<select>').attr('id', id+"_select");
      options.forEach(function (obj) {
        select.append($('<option>').attr('value', obj.value).append(obj.name));
      });
    } else {
      select = options;
    }
    return $('<tr>').attr('id',id+"_parent").append($('<td>')
            .append($("<button>")
              .attr('id', id)
              .attr('type', "button")
              .click(callback)
              .append(buttonText)
              )
              .append(midText)
              .append(select)
            );
  },
  createTitle: (id, text, cssclass) => {
    return $('<tr>').attr('id', id).append($('<td>').attr('class', cssclass || "selected").append(text));
  },
  createFileBrowser: (id, text, multiple, callback) => {
    var updateFunction = function(event) {
      var fileArray = [];
      for (var i = 0; i < event.target.files.length; i++) {
        var f = event.target.files[i];
        fileArray.push({
          name: f.name,
          uri: URL.createObjectURL(f)
        });
      }
      callback(fileArray);
    };
    return $('<tr>').attr('id', id+"_parent").append($('<td>')
      .append(text+": <br/>")
      .append($("<input>")
        .attr('id', id)
        .attr('type', 'file')
        // .obj, .json doesn't work in Safari...
        //.attr('accept', '.obj,.json,.dae,.mtl,image/*')
        .attr('multiple', multiple? '' : false)
        .change(updateFunction)
      )
    );
  },
  createSubGroup: (id, text, elements, parent) => {
    return UiUtils.createGroup(id, text, elements, "subgroup", parent);
  },

  createGroup: (id, text, elements, cssclass, parent) => {
    var elementIds = [];
    elements.forEach(function(element) {
      // *_parent ids
      elementIds.push(element.attr('id'));
    });
    var toggle = function() {
      if (elementIds.length > 0) {
        // based on the first element so subgroups are collapsed as well
        const hidden = $("#"+elementIds[0]).is(":hidden");
        const delay = 0;
        elementIds.forEach(function(elementId) {
          if (hidden) {
            var p = $("#"+elementId).attr('parent');
            if (!p || p === id) {
              $("#"+elementId).show(delay);
            }
          } else {
            $("#"+elementId).hide(delay);
          }
        });
      }
    };
    var title = UiUtils.createTitle(id, text, cssclass).click(toggle);
    if (parent) {
      title.attr('parent', parent);
    }
    return [title].concat(elements);
  },

  addGroup: (id, text, elements, parent) => {
    var group = UiUtils.createGroup(id, text, elements);
    UiUtils.addToTable(group, parent);
  },

  addToTable: (group, parent) => {
    var tbody = $(parent || "#controls").find('tbody');
    group.forEach(function(element) {
      tbody.append(element);
    });
  }

};
export {UiUtils as default};