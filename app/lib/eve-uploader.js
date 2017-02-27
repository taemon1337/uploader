var fs = require('fs')
  , bhttp = require('bhttp')
  , Promise = require('bluebird')
  , API = process.env.API || "http://api:8080/api"
;

var uploadForm = function(url, data, success, failure) {
  Promise.try(function() {
    return bhttp.post(url, data, { forceMultipart: true })
  }).then(function(resp) {
    if(resp.statusCode > 399) {
      console.log(resp.statusMessage, resp.body)
      failure()
    } else {
      console.log("SUCCESS: ", resp.body)
      success()
    }
  }).catch(function(err) {
    console.log("FAILURE: ", err)
    failure()
  });
}

module.exports = function(file, uuid, fields, success, failure, uploader) {
  try {
    var infofile = file.path+".json";
    var json = {}
    if(fs.existsSync(infofile)) {
      fs.readFile(infofile,'utf8', function(err, data) {
        if(err) throw err;
        json = JSON.parse(data)
      })
    }

    json.filename = file.name[0].toString()
    json.content_type = file.content_type || "?"
    json.file = fs.createReadStream(file.path)

    uploadForm(API+"/documents", json, success, failure);
  } catch(err) {
    console.warn("Err: ", err);
    failure()
  }
}
