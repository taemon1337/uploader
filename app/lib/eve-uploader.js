var fs = require('fs')
  , bhttp = require('bhttp')
  , Promise = require('bluebird')
  , API = process.env.API || "http://api:8080/api"
;

module.exports = function(file, uuid, success, failure, uploader) {
  var infofile = file.path+".json";
  var json = {}
  if(fs.existsSync(infofile)) {
    fs.readFile(infofile,'utf8', function(err, data) {
      if(err) throw err;
      json = JSON.parse(data)
    })
  }

  json.filename = file.name
  json.content_type = file.type || ""
  json.file = fs.createReadStream(file.path)

  Promise.try(function() {
    console.log("SENDING TO API...", file.path);
    return bhttp.post(API+"/documents", json, { forceMultipart: true })
  })
  .then(function(resp) {
    console.log("EVE RESPONSE: ", resp);
    success()
  })
  .catch(function(err) {
    console.log("EVE ERR: ", err);
    failure()
  })
}
