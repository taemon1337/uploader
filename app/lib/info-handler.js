var fs = require('fs');

var cleanValue = function(val) {
  return typeof val === "object" && val.length ? val.join(',') : val
}

var parseFileFields = function(file,fields) {
  var parsed = { filename: file.name, size: file.size, datetime: new Date() };
  for(var key in fields) {
    if(!key.startsWith("qq")) {
      parsed[key] = cleanValue(fields[key])
    }
  }
  return parsed;
}

module.exports = function(file, uuid, fields, success, failure, uploader) {
  var infofile = uploader.getFileInfoPath(file, uuid);
  fs.writeFile(infofile, JSON.stringify(parseFileFields(file,fields),null,2), function(err) {
    if(err) {
      console.log("Error writing info file", err)
      failure()
    } else {
      success()
    }
  })
}

