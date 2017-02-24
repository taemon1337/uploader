var fs = require("fs")
  , rimraf = require("rimraf")
  , mkdirp = require("mkdirp")
  , qs = require('querystring')
  , multiparty = require('multiparty')
;

function Uploader(opts) {
  var opts = opts || {}
  if(!(this instanceof Uploader)) {
    return new Uploader(opts);
  }

  this.fileInputName = opts.fileInputName || "qqfile";
  this.uploadPath = opts.uploadPath || "/uploads/";
  this.chunksName = opts.chunksName || "chunks";
  this.maxFileSize = opts.maxFileSize || 0;

  // a file handler is a callback function that receives (file, uuid, success, failure, uplaoder)
  this.fileHandlers = opts.fileHandlers || []
}

Uploader.prototype = {
  mount: function(app) {
    var self = this;
    app.post("/uploads", function(req, res) { return self.onUpload(req, res) });
    app.delete("/uploads/:uuid", function(req, res) { return self.onDeleteFile(req, res) });
    app.post("/uploads/:uuid/info", function(req, res) { return self.onUploadInfo(req, res) });
//app.post("/upload-complete", function(req, res) { return self.onChunkedUploadComplete(req, res) });
  },
  addFileHandler: function(fileHandler) {
    this.fileHandlers.push(fileHandler);
  },
  handleUploadedFile: function(file, uuid, success, failure) {
    var self = this;
    var len = self.fileHandlers.length

    var handle = function(i) {
      console.log("FILE HANDLER: ", i)
      var next = function() { handle(i+1) }

      if(i < len) {
        self.fileHandlers[i](file, uuid, next, failure, self);
      } else {
        console.log("FILE HANDLERS DONE")
        success()
      }
    }

    handle(0);
  },
  parseForm: function(req, cb) {
    var form = new multiparty.Form();

    form.parse(req, function(err, fields, files) {
      cb(err, fields, files)
    });
  },
  onUpload: function(req, res) {
    var self = this;
    self.parseForm(req, function(err, fields, files) {
      if(!err && fields && files) {
        var partIndex = fields.qqpartindex;

        // text/plain is required to ensure support for IE9 and older
        res.set("Content-Type", "text/plain");

        if (partIndex == null) {
          self.onSimpleUpload(fields, files[self.fileInputName][0], res);
        }
        else {
          self.onChunkedUpload(fields, files[self.fileInputName][0], res);
        }
      } else {
        console.warn("Parsed Empty!", err.message);
      }
    })
  },
  onSimpleUpload: function(fields, file, res) {
    var self = this;
    var uuid = fields.qquuid;
    var responseData = { success: false };
    var failure = function() {
      responseData.error = "Problem copying the file!"
      res.send(responseData)
    }

    file.name = fields.qqfilename;

    if(self.isValid(file.size)) {
      console.log("UPLOAD: ", file.name, uuid);
      self.moveUploadedFile(file, uuid, function(destinationPath) {
        file.path = destinationPath; // moved to this path
        responseData.success = true
        self.handleUploadedFile(file, uuid, function() {
          res.send(responseData)
        }, failure);
      }, failure);
    } else {
      self.failWithTooBigFile(responseData, res);
    }
  },
  onChunkedUpload: function(fields, file, res) {
    var self = this,
        size = parseInt(fields.qqtotalfilesize),
        uuid = fields.qquuid,
        index = fields.qqpartindex,
        totalParts = parseInt(fields.qqtotalparts),
        responseData = {
            success: false
        };

    file.name = fields.qqfilename;

    if(self.isValid(size)) {
      self.storeChunk(file, uuid, index, totalParts, function() {
        if (index < totalParts - 1) {
//          console.log("CHUNK: ",Math.floor(index/totalParts*100),"%",file.name,uuid)
          responseData.success = true;
          res.send(responseData);
        }
        else {
          self.combineChunks(file.name, uuid, function() {
            console.log("UPLOAD: ", file.name, uuid);
            responseData.success = true;
            res.send(responseData);
          },
          function() {
            responseData.error = "Problem conbining the chunks!";
            res.send(responseData);
          });
        }
      },
      function(reset) {
        responseData.error = "Problem storing the chunk!";
        res.send(responseData);
      });
    }
    else {
      self.failWithTooBigFile(responseData, res);
    }
  },
  onUploadInfo: function(req, res) {
    var self = this;
    self.parseForm(req, function(err, fields, files) {
      res.set("Content-Type", "text/plain");

      var uuid = req.params.uuid,
          dir = self.uploadPath + uuid;

      if(fields && fields.filename) {
        fs.writeFile(dir+"/"+fields.filename+".json", JSON.stringify(fields,null,2));
        res.send({ success: true });
      } else {
        res.send({ success: false, error: "No fields or filename" })
      }
    })
  },
  onChunkedUploadComplete: function(req, res) {
    var self = this;
    var body = "";

    req.on('data', function(data) {
      body += data.toString('utf-8');
    })

    req.on('end', function() {
      body = qs.parse(body);

      if(body.qquuid && body.qqfilename) {
        self.combineChunks(body.qqfilename, body.qquuid, function() {
          console.log("UPLOAD: ", body.qqfilename, body.qquid);
          res.send({ success: true });
        },
        function() {
          res.status(500).send({ success: false, error: "Problem combining chunks!" });
        });
      }
    })

    req.on('error', function(err) {
      res.status(500).send({ success: false, error: err });
    })
  },
  failWithTooBigFile: function(responseData, res) {
    responseData.error = "Too big!";
    responseData.preventRetry = true;
    res.send(responseData);
  },
  onDeleteFile: function(req, res) {
    var self = this,
        uuid = req.params.uuid,
        dirToDelete = self.uploadPath + uuid;

    rimraf(dirToDelete, function(error) {
      if (error) {
        console.error("Problem deleting file! " + error);
        res.status(500);
      }

      console.log("DELETE: ", uuid);
      res.send();
    });
  },
  isValid: function(size) {
    return this.maxFileSize === 0 || size < this.maxFileSize;
  },
  moveUploadedFile: function(file, uuid, success, failure) {
    var destinationDir = this.uploadPath + uuid + "/",
        fileDestination = destinationDir + file.name;

    this.moveFile(destinationDir, file.path, fileDestination, success, failure);
  },
  moveFile: function(destinationDir, sourceFile, destinationFile, success, failure) {
    mkdirp(destinationDir, function(error) {
      var sourceStream, destStream;

      if(error) {
        console.error("Problem creating directory " + destinationDir + ": " + error);
        failure();
      } else {
        sourceStream = fs.createReadStream(sourceFile);
        destStream = fs.createWriteStream(destinationFile);

        sourceStream
        .on("error", function(error) {
          console.error("Problem copying file: " + error.stack);
          destStream.end();
          failure();
        })
        .on("end", function(){
          destStream.end();
          success(destinationFile);
        })
        .pipe(destStream);
      }
    });
  },
  storeChunk: function(file, uuid, index, numChunks, success, failure) {
    var destinationDir = this.uploadPath + uuid + "/" + this.chunksName + "/",
        chunkFilename = this.getChunkFilename(index, numChunks),
        fileDestination = destinationDir + chunkFilename;

    this.moveFile(destinationDir, file.path, fileDestination, success, failure);
  },
  combineChunks: function(filename, uuid, success, failure) {
    var self = this,
      chunksDir = self.uploadPath + uuid + "/" + self.chunksName + "/",
      destinationDir = self.uploadPath + uuid + "/",
      fileDestination = destinationDir + filename;

    fs.readdir(chunksDir, function(err, fileNames) {
      var destFileStream;

      if(err) {
        console.error("Problem listing chunks! " + err);
        failure();
      }
      else {
        fileNames.sort();
        destFileStream = fs.createWriteStream(fileDestination, {flags: "a"});

        self.appendToStream(destFileStream, chunksDir, fileNames, 0, function() {
          rimraf(chunksDir, function(rimrafError) {
            if (rimrafError) {
                console.log("Problem deleting chunks dir! " + rimrafError);
            }
          });
          success();
        },
        failure);
      }
    });
  },
  appendToStream: function(destStream, srcDir, srcFilesnames, index, success, failure) {
    var self = this;
    if(index < srcFilesnames.length) {
      fs.createReadStream(srcDir + srcFilesnames[index])
      .on("end", function() {
        self.appendToStream(destStream, srcDir, srcFilesnames, index + 1, success, failure);
      })
      .on("error", function(error) {
        console.error("Problem appending chunk! " + error);
        destStream.end();
        failure();
      })
      .pipe(destStream, {end: false});
    }
    else {
      destStream.end();
      success();
    }
  },
  getChunkFilename: function(index, count) {
    var digits = new String(count).length,
        zeros = new Array(digits + 1).join("0");

    return (zeros + index).slice(-digits);
  }
}

module.exports = Uploader;
