(function() {
  "use strict";

  function populateControls() {
    var AnimationSettings = {
      hideDelay: 0
    };
    function createSlider(id, text, value, min, max, step, callback) {
      var numberId = id + "_number";
      var sliderUpdateFunction = function(event) {
        $("#"+numberId).attr('value', event.target.value);
        callback(event.target.value);
      };
      var numberUpdateFunction = function(event) {
        $("#"+id).attr('value', event.target.value);
        callback(event.target.value);
      };
      return $('<tr>').attr('id',id+"_parent").append($('<td>')
              .append(text+": <br/>")
              .append($('<input>')
                .attr('id', numberId)
                .attr('type', 'number')
                .attr('value', value)
                .change(numberUpdateFunction)
              )
              .append($('<input>')
                  .attr('id', id)
                  .attr('type', 'range')
                  .attr('min', min)
                  .attr('max', max)
                  .attr('step', step)
                  .attr('value', value)
                  .on('input', sliderUpdateFunction)
                  .change(sliderUpdateFunction)
              )
      );
    }

    function createCheckbox(id, checked, callback) {
      var updateFunction = function(event) {
        callback(event.target.checked);
      };
      return $('<tr>').attr('id',id+"_parent").append($('<td>')
              .append(id+": ")
              .append($('<input>')
                .attr('id', id)
                .attr('type', "checkbox")
                .prop('checked', checked)
                .change(updateFunction))
      );
    }

    function createDropdownList(id, list, callback) {
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
    }

    function addUrisToDropdownList(id, list) {
      var select = $('#'+id);
      list.forEach(function (obj) {
        var option = $('<option>').attr('value', obj.uri).append(obj.name);
        select.append(option);
      });
    }

    function createButton(id, text, callback) {
      return $('<tr>').attr('id',id+"_parent").append($('<td>')
              .append($("<button>")
                .attr('id', id)
                .attr('type', "button")
                .click(callback)
                .append(text))
              );
    }

    function createButtonWithOptions(id, buttonText, midText, options, callback) {
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
    }

    function createTitle(id, text, cssclass) {
      return $('<tr>').attr('id', id).append($('<td>').attr('class', cssclass || "selected").append(text));
    }

    function createFileBrowser(id, text, multiple, callback) {
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
    }

    function createSubGroup(id, text, elements, parent) {
      return createGroup(id, text, elements, "subgroup", parent);
    }

    function createGroup(id, text, elements, cssclass, parent) {
      var elementIds = [];
      elements.forEach(function(element) {
        // *_parent ids
        elementIds.push(element.attr('id'));
      });
      var toggle = function() {
        if (elementIds.length > 0) {
          // based on the first element so subgroups are collapsed as well
          var hidden = $("#"+elementIds[0]).is(":hidden");
          var d = AnimationSettings.hideDelay;
          elementIds.forEach(function(elementId) {
            if (hidden) {
              var p = $("#"+elementId).attr('parent');
              if (!p || p === id) {
                $("#"+elementId).show(d);
              }
            } else {
              $("#"+elementId).hide(d);
            }
          });
        }
      };
      var title = createTitle(id, text, cssclass).click(toggle);
      if (parent) {
        title.attr('parent', parent);
      }
      return [title].concat(elements);
    }

    function addGroup(id, text, elements, parent) {
      var group = createGroup(id, text, elements);
      addToTable(group, parent);
    }

    function addToTable(group, parent) {
      var tbody = $(parent || "#controls").find('tbody');
      group.forEach(function(element) {
        tbody.append(element);
      });
    }


    ViewParameters.onRotation = function() {
      if (ViewParameters.modelRotationTheta < 0) {
        ViewParameters.modelRotationTheta += 2 * Math.PI;
      }
      if (ViewParameters.modelRotationTheta > 2 * Math.PI) {
        ViewParameters.modelRotationTheta -= 2 * Math.PI;
      }
      if (ViewParameters.modelRotationPhi < 0) {
        ViewParameters.modelRotationPhi += 2 * Math.PI;
      }
      if (ViewParameters.modelRotationPhi > 2 * Math.PI) {
        ViewParameters.modelRotationPhi -= 2 * Math.PI;
      }
      $("#modelRotationTheta").attr('value', ViewParameters.modelRotationTheta);
      $("#modelRotationTheta_number").attr('value', ViewParameters.modelRotationTheta);
      $("#modelRotationPhi").attr('value', ViewParameters.modelRotationPhi);
      $("#modelRotationPhi_number").attr('value', ViewParameters.modelRotationPhi);
    };

    ViewParameters.onModelLoad = function(modelData) {
      removePoseGroup();
      if (modelData.skinnedModel) {
        $("#keyframe").attr('max', modelData.skinnedModel.keyframeCount - 1);
        $("#keyframe_number").attr('value', -1);
        ViewParameters.keyframe = -1;
        addPoseGroup(modelData.skinnedModel);
      }
    };

    ViewParameters.onChangeKeyframe = function(skinnedModel) {
      removePoseGroup();
      addPoseGroup(skinnedModel);
    };

    function onChangeFileBrowser(values) {
      var models = [];
      for (var i = 0 ; i < values.length; i++) {
        var ext = GFX.getFileExtension(values[i].name);
        if (ext === "Json" || ext === "Obj" || ext === "Dae") {
          models.push(values[i]);
        } else if (ext === "Mtl") {
          ViewParameters.materialUris[values[i].name] = values[i].uri;
        } else { // the rest should be images!
          ViewParameters.imageUris[values[i].name] = values[i].uri;
        }
      }
      // add models to preset list
      if (models.length > 0) {
        ViewParameters.model = models[0];
        addUrisToDropdownList("Presets", models);
      }
    }

    function onAddPoseFiles(values) {
      function readPoseFile(i) {
        if (i >= values.length) {
          return;
        }
        var ext = GFX.getFileExtension(values[i].name);
        if (ext === "Json") {
          $.getJSON(values[i].uri, function(pose) {
            ViewParameters.addPose(pose.pose);
            readPoseFile(i+1);
          });
        } else {
          console.warn("Unknown extension: " + values[i].name);
          readPoseFile(i+1);
        }
      }
      readPoseFile(0);
    }

    function onAddJroFile(values) {
      var f = values[0];
      var ext = GFX.getFileExtension(f.name);
      if (ext === "Json") {
        $.getJSON(f.uri, function(jro) {
          ViewParameters.addJointRotationOrder(jro);
        });
      } else {
        console.warn("Unknown extension: " + f.name);
      }
    }

    function removePoseGroup() {
      $("tr[id^=gPose]").remove();
    }

    function addPoseGroup(skinnedModel) {
      var id = "gPose";
      var frame = ViewParameters.keyframe;
      var pose = skinnedModel.getPoseFile(frame).pose;
      function updateJointWithValue(joint, key, value) {
        skinnedModel.setAnimValue(joint, frame, key, parseFloat(value));
        skinnedModel.applyPose(frame);
      }
      function angleSlider(s, joint, axis, value) {
        var slider = createSlider(s+"_angle"+axis, "rotation "+axis, value, -180, 180, 0.1, updateJointWithValue.bind(null, joint, "rotate"+axis+".ANGLE"));
        slider.attr('parent', id+"_"+joint);
        return slider;
      }
      function createControls(skeleton, parent) {
        var joints = Object.keys(skeleton);
        var controls = [];
        joints.forEach(function (joint) {
          var transform = pose[joint] || [];
          var rx = transform[0] || 0;
          var ry = transform[1] || 0;
          var rz = transform[2] || 0;
          var subId = id+"_"+joint;
          var subcontrols = [
            angleSlider(subId, joint, "X", rx),
            angleSlider(subId, joint, "Y", ry),
            angleSlider(subId, joint, "Z", rz)
          ];
          var jointControls = createControls(skeleton[joint], subId);
          subcontrols = subcontrols.concat(jointControls);
          var jointGroup = createSubGroup(subId, joint, subcontrols, parent);
          controls = controls.concat(jointGroup);
        });
        return controls;
      }
      var controls = createControls(skinnedModel.getSkeletonTopology());
      addGroup(id, "Pose Controls", controls, "#controlsRight");
      // hide the sliders by clicking twice to toggle controls
      $("#gPose").click();
      $("#gPose").click();
    }

    var modelPresets = [
      "pear.json",
      "banana.json",
      "orange.json",
      "banana.obj",
      "tree01.dae",
      "monigote.dae"].map(function(e) {
      return {name: e, value: "resources/"+e};
    });
    var missingTexturePresets = [
      {name: "uvChecker", value: "resources/UVTextureChecker4096.png"},
      {name: "white", value: "resources/white.png"}];
    // Create the UI controls
    addGroup("gFile", "File", [
      createFileBrowser("fileBrowser", "load models & textures", true, onChangeFileBrowser),
      createDropdownList("Presets", modelPresets, function(obj) {
        ViewParameters.model = obj;
      }),
      createButtonWithOptions("saveFile", "Save", " as ", [{name: "OBJ Wavefront", value:".obj"}, {name: "Json", value:".json"}], function (e) {
        var modelType = $("#"+e.target.id+"_select").attr("value");
        console.log(modelType);
        GFX.exportModel(ViewParameters, modelType);
      }),
    ]);
    addGroup("gModel", "Model Settings", [
      createCheckbox("lockRotationY", window.ViewParameters.isLockRotationY, function(value) {
        ViewParameters.isLockRotationY = value;
      }),
      createCheckbox("z_up", window.ViewParameters.isZAxisUp, function(value) {
        ViewParameters.isZAxisUp = value;
        ViewParameters.needsReload = true;
      }),
      createSlider("modelScaleExp10", "scale", 0, -3, 3, 0.2, function(value) {
        ViewParameters.modelScale = Math.pow(10, parseFloat(value));
      }),
      createSlider("modelRotationTheta", "rotation Y axis",
        ViewParameters.modelRotationTheta, 0, 2 * Math.PI, 0.01, function(value) {
          ViewParameters.modelRotationTheta = parseFloat(value);
      }),
      createCheckbox("lockRotationX", window.ViewParameters.isLockRotationX, function(value) {
        ViewParameters.isLockRotationX = value;
      }),
      createSlider("modelRotationPhi", "rotation X axis",
        ViewParameters.modelRotationPhi, 0, 2 * Math.PI, 0.01, function(value) {
          ViewParameters.modelRotationPhi = parseFloat(value);
      })
    ]);
    addGroup("gCamera", "Camera Settings", [
      createSlider("cameraDistance", "distance",
        ViewParameters.cameraDistance, 0.2, 10, 0.01, function(value) {
          ViewParameters.cameraDistance = parseFloat(value);
      }),
      createSlider("cameraHeight", "height",
        ViewParameters.cameraHeight, -2, 2, 0.01, function(value) {
          ViewParameters.cameraHeight = parseFloat(value);
      }),
      createSlider("cameraPitch", "pitch",
        ViewParameters.cameraPitch, -90, 90, 1, function(value) {
          ViewParameters.cameraPitch = parseFloat(value);
      }),
      createSlider("cameraFOV", "Field of View",
        ViewParameters.cameraFOV, 1, 90, 1, function(value) {
          ViewParameters.cameraFOV = parseFloat(value);
      })
    ]);
    addGroup("gLight", "Light Settings", [
      createSlider("SunAltitude", "sun altitude", ViewParameters.getSunAltitude(), -1, 1, 0.05, function(value) {
        ViewParameters.setSunAltitude(value);
      }),
      createSlider("SunEastWest", "sun east-west", ViewParameters.getSunEastWest(), -1, 1, 0.05, function(value) {
        ViewParameters.setSunEastWest(value);
      })
    ]);
    addGroup("gShader", "Shader Settings", [
      createDropdownList("missingTexture", missingTexturePresets, function(obj) {
        ViewParameters.imageUris.missing = obj.uri;
        ViewParameters.needsReload = true;
      })
    ]);
    addGroup("gAnim", "Animation Controls", [
      createSlider("keyframe", "keyframe",
      ViewParameters.keyframe, -1, -1, 1, function(value) {
        ViewParameters.keyframe = parseInt(value);
      }),
      createFileBrowser("posefileBrowser", "load keyframe/pose", true, onAddPoseFiles),
      createFileBrowser("jrofileBrowser", "load joint rotation order", false, onAddJroFile),
      createButtonWithOptions("savePose", "Save Pose", " as ", "Json", ViewParameters.saveCurrentPose)
    ], "#controlsRight");
  }

  $( document ).ready(function() {
    populateControls();
  });
})();
