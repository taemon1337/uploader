var fs = require('fs')
  , path = require('path')
  , crypto = require('crypto')
  , rimraf = require("rimraf")
  , Archiver = require('archiver')
;

var commonStart = function(array) {
  var A = array.concat().sort(), a1=A[0], a2=A[A.length-1], L=a1.length, i=0;
  while(i<L && a1.charAt(i) === a2.charAt(i)) i++;
  return a1.substring(0,i);
}

module.exports = function(group,sessionID, fields, success, failure, uploader) {
  if(fields.zip) {
    var dir = uploader.getUploadPath(group,sessionID);
    var zipfile = dir + ".zip"
//    var zip = new Archiver('zip', { store: false, zlib: { level: 0 }});
    var zip = new Archiver('zip');
    var output = fs.createWriteStream(zipfile);
    var allinfo = { filename: path.basename(zipfile), content_type: "application/zip", children: [] };
    var md5 = crypto.createHash('md5');
    var sha1 = crypto.createHash('sha1');
    var sha256 = crypto.createHash('sha256');

    for(var key in fields) { allinfo[key] = fields[key] };

    zip.on('error', function(err) {
      console.warn("Error generating zip archive " + zipfile, err);
      failure(err)
    })

    output
    .on('data', function(chunk) {
      md5.update(chunk);
      sha1.update(chunk);
      sha256.update(chunk);
    })
    .on('close', function() {
      allinfo.md5    = md5.digest('hex'),
      allinfo.sha1   = sha1.digest('hex'),
      allinfo.sha256 = sha256.digest('hex')

      if(allinfo.children.length < 2) {
        allinfo.filename = allinfo.children[0].filename+".zip";
      } else {
        var common = commonStart(allinfo.children.map(function(c) { return c.filename }));
        if(common.length > 2) {
          allinfo.filename = (common+".zip").replace('..','.')
        }
      }

      fs.writeFile(zipfile+".json", JSON.stringify(allinfo,null,2), function(err) {
        if(err) { console.warn("Error writing info file for " + zipfile, err); }
      });

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
    .on('error', function(err) {
      console.log("Error writing to output stream " + zipfile, err);
      failure(err);
    });

    fs.readdirSync(dir).forEach(function(uuid) {
      fs.readdirSync(dir+"/"+uuid).forEach(function(filename) {
        var fname = filename
        if(filename.endsWith(".json-part")) {
          try {
            fname = fname.replace(".json-part",".json")
            var d = fs.readFileSync(dir+"/"+uuid+"/"+filename, { encoding: "utf8" });
            var j = JSON.parse(d)
            allinfo.children.push(j)
          } catch(err) {
            console.warn("Error reading/parsing " + filename, err);
          }
        }
        zip.file(dir+"/"+uuid+"/"+filename, { name: fname })
      })
    })

    zip.pipe(output)
    zip.finalize();
  } else {
    success()
  }
}
