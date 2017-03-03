var fs = require('fs')
  , rimraf = require("rimraf")
  , yazl = require('yazl')
;

module.exports = function(group,sessionID, fields, success, failure, uploader) {
  if(fields.zip) {
    var dir = uploader.getUploadPath(group,sessionID);
    var zipfile = dir + ".zip"
    var zip = new yazl.ZipFile();

    fs.readdirSync(dir).forEach(function(uuid) {
      fs.readdirSync(dir+"/"+uuid).forEach(function(filename) {
        zip.addFile(dir+"/"+uuid+"/"+filename, filename)
      })
    })

    if(zip.outputStream) {
      zip.outputStream
      .pipe(fs.createWriteStream(zipfile))
      .on("close", function() {
        rimraf(dir, function(err) {
          if (err) {
            console.error("Problem deleting directory " + dir, err);
            failure(err)
          } else {
            console.log("Zipped " + dir + " into " + zipfile);
            success();
          }
        });
      })
      .on("error", function(err) {
        console.log("Error generating zip file " + zipfile, err);
        failure(err)
      });

      zip.end();
    } else {
      console.log("No outstream in zip!", zip);
      failure()
    }
  } else {
    success()
  }
}
