var fs = require('fs');

var cleanValue = function(val) {
  return typeof val === "object" && val.length ? val.join(',') : val
}

var cleanFields = function(fields) {
  var cleaned = {}
  for(var key in fields) {
    if(!key.startsWith("qq")) {
      cleaned[key] = cleanValue(fields[key])
    }
  }
  return cleaned;
}

module.exports = function(file, uuid, fields, success, failure, uploader) {
  var infofile = uploader.uploadPath+uuid+"/"+file.name+".json";
  fs.writeFile(infofile, JSON.stringify(cleanFields(fields),null,2), function(err) {
    if(err) {
      console.log("Error writing info file", err)
      failure()
    } else {
      success()
    }
  })
}

