$(function() {
  var s4 = function() { return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1); }
  var guid = function() { return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4(); }
  var parseUrl = function(search) {
    var qs = {}
    search.substr(1).split("&").forEach(function(pair) {
      if(pair === "") return;
      var parts = pair.split('=');
      qs[parts[0]] = parts[1] && decodeURIComponent(parts[1].replace(/\+/g," "));
    })
    return qs;
  }
  var populate = function(frm, data) {
    $.each(data, function(key, value) {
      var ctrl = $('[name='+key+']', frm);
      switch(ctrl.prop("type")) {
        case "radio": case "checkbox":
          ctrl.each(function() {
              if($(this).attr('value') == value) $(this).attr("checked",value);
          });
          break;
        default:
          ctrl.val(value);
      }
    });  
  }

  var form = document.forms[0];
  var uploadButton = $("button[type=submit]");
  var uploadProgress = $(".progress-bar");
  var sessionID = guid();
  var initdata = parseUrl(window.location.search);
  initdata.sessionID = sessionID;

  populate(form, initdata); // insert url params as form values

  var serializeForm = function(form) {
    var data = {}
    $(form).serializeArray().forEach(function(item) { data[item.name] = item.value })
    return data
  }

  window.GoParamUrl = function() {
    var params = serializeForm(form)
    delete params.sessionID;
    window.location = window.location.origin + "?" + $.param(params);
  }

  var uploader = new qq.FineUploader({
    debug: true,
    element: document.getElementById('uploader'),
    resume: {
      enabled: true
    },
    chunking: {
      enabled: true
/*
      concurrent: {
        enabled: true
      },
      success: {
        endpoint: "/upload-complete"
      }
*/
    },
    request: {
      endpoint: "/uploads",
      forceMultipart: true
    },
    classes: {
      buttonHover: "",
      success: "list-group-item-success",
      fail: "list-group-item-danger",
      retryable: "list-group-item-warning"
    },
    callbacks: {
      onSubmit: function(id, name) {
        this.setParams({ content_type: this.getFile(id).type }, id);
      },
      onUpload: function() {
        uploadButton.addClass("disabled");
        uploadProgress.addClass("progress-bar-striped active")
      },
      onAllComplete: function(succeeded, failed) {
        uploadButton.removeClass("disabled")
        uploadProgress.removeClass("progress-bar-info active")
        if(failed.length) {
          uploadProgress.addClass("progress-bar-danger");
        } else {
          $.ajax({
            url: "/session-complete",
            data: serializeForm(form),
            type: "POST",
            contentType: "application/json",
            success: function() {
              uploadProgress.addClass("progress-bar-success");
              setTimeout(window.GoParamUrl, 3000);
            },
            failure: function(resp) {
              uploadProgress.addClass("progress-bar-danger");
              alert(JSON.stringify(resp,null,2));
            },
            error: function(resp) {
              uploadProgress.addClass("progress-bar-danger");
              alert(JSON.stringify(resp,null,2));
            }
          })
        }
      },
      onTotalProgress: function(current, total) {
        uploadProgress.css({ width: Math.round(current/total*100)+"%" })
      }
    }
  });
});
