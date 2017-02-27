var fs = require('fs')
  , crypto = require('crypto')
;

module.exports = function(file, uuid, fields, success, failure, uploader) {
  var infofile = uploader.uploadPath+uuid+"/"+file.name+".json"
  if(fs.existsSync(infofile)) {
    fs.readFile(infofile,'utf8', function(err, data) {
      if(err) throw err;
      var info = JSON.parse(data)
      var md5 = crypto.createHash('md5');
      var sha1 = crypto.createHash('sha1');
      var sha256 = crypto.createHash('sha256');
      var readstream = fs.createReadStream(file.path)

      readstream.on('data', function(data) {
        md5.update(data);
        sha1.update(data);
        sha256.update(data);
      });

      readstream.on('end', function() {
        info.md5    = md5.digest('hex'),
        info.sha1   = sha1.digest('hex'),
        info.sha256 = sha256.digest('hex')

        fs.writeFile(infofile, JSON.stringify(info,null,2), function(err) {
          if(err) {
            console.log("Error writing updated info file with hashes!", err)
            failure()
          } else {
            success()
          }
        })
      });

      readstream.read();
    })
  }
}

