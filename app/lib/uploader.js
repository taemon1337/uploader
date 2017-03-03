var fs = require("fs")
  , rimraf = require("rimraf")
  , mkdirp = require("mkdirp")
  , qs = require('querystring')
  , crypto = require('crypto')
  , SECRET = process.env.SECRET || 'hmac-secret-thingy-for-hashing'
  , ORGS = process.env.ORGS || ['DFS','FSL','TFSD']
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

  // a session handler is a callback function that runs after every file in the session has completed
  // (sessionID, [uuids], success, failure, uploader)
  this.sessionHandlers = opts.sessionHandlers || []
}

Uploader.prototype = {
  mount: function(app) {
    var self = this;
    app.post("/uploads", function(req, res) { return self.onUpload(req, res) });
    app.post("/session-complete", function(req, res) { return self.onSessionComplete(req, res) });
//    app.post("/upload-complete", function(req, res) { return self.onChunkedUploadComplete(req, res) });
  },
  addFileHandler: function(fileHandler) {
    this.fileHandlers.push(fileHandler);
  },
  addSessionHandler: function(sessionHandler) {
    this.sessionHandlers.push(sessionHandler);
  },
  handleUploadedFile: function(file, uuid, fields, success, failure) {
    var self = this;
    var len = self.fileHandlers.length

    var handle = function(i) {
      var next = function() { handle(i+1) }

      if(i < len) {
        self.fileHandlers[i](file, uuid, fields, next, failure, self);
      } else {
        success()
      }
    }
    handle(0);
  },
  handleCompletedSession: function(fields, success, failure) {
    var self = this;
    var len = self.sessionHandlers.length;

    var handle = function(i) {
      var next = function() { handle(i+1) }

      if(i < len) {
        self.sessionHandlers[i](fields.org, fields.sessionID, fields, next, failure, self);
      } else {
        self.finalizeSessionInfoFiles(fields.org, fields.sessionID, success, failure);
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
  validateFields: function(fields) {
    return (fields.sessionID.toString().match(/^[\da-f-]+$/) && ORGS.indexOf(fields.org.toString()) >= -1)
  },
  parseFile: function(files, fields) {
    var self = this;
    if(self.validateFields(fields)) {
      var file = files[self.fileInputName][0];
      file.name = fields.qqfilename.toString();
      file.sessionID = fields.sessionID.toString();
      file.group = fields.org.toString();
      return file;
    }
  },
  onUpload: function(req, res) {
    var self = this;
    self.parseForm(req, function(err, fields, files) {
      if(!err && fields && files) {
        var partIndex = fields.qqpartindex;
        var file = self.parseFile(files, fields);
        if(file) {

          // text/plain is required to ensure support for IE9 and older
          res.set("Content-Type", "text/plain");

          if (partIndex == null) {
            self.onSimpleUpload(fields, file, res);
          }
          else {
            self.onChunkedUpload(fields, file, res);
          }
        } else {
          console.log("Invalid parsed file ", files, fields);
          res.status(500).send("Invalid Request!")
        }
      } else {
        console.warn("Parsed Empty!", err.message);
        res.status(500).send("Invalid Request!")
      }
    })
  },
  onSessionComplete: function(req, res) {
    var self = this;
    var body = "";
    var hasFailed = false;

    req.on('data', function(data) {
      body += data.toString('utf-8');
    })

    req.on('end', function() {
      var fields = qs.parse(body);
      self.handleCompletedSession(fields, function() {
        if(!hasFailed) {
          res.send({ success: true });
        }
      }, function(err) {
        res.send({ success: false, error: err });
        hasFailed = true;
      })
    })

    req.on('error', function(err) {
      res.status(500).send({ success: false, error: err });
    })
  },
  onSimpleUpload: function(fields, file, res) {
    var self = this;
    var uuid = fields.qquuid;
    var responseData = { success: false };
    var hasFailed = false;
    var failure = function() {
      hasFailed = true
      responseData.error = "Problem copying the file!"
      res.send(responseData)
    }

    if(self.isValid(file.size)) {
      console.log("Receiving upload " + file.name, uuid);
      self.moveUploadedFile(file, uuid, function(destinationPath) {
        file.path = destinationPath; // moved to this path
        self.handleUploadedFile(file, uuid, fields, function() {
          if(!hasFailed) {
            responseData.success = true
            res.send(responseData)
          }
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
    var hasFailed = false;
    var failure = function() {
      responseData.error = "Problem combining the chunks!"
      res.send(responseData)
      hasFailed = true
    }

    if(self.isValid(size)) {
      self.storeChunk(file, uuid, index, totalParts, function() {
        if (index < totalParts - 1) {
//          console.log("CHUNK: ",Math.floor(index/totalParts*100),"%",file.name,uuid)
          responseData.success = true;
          res.send(responseData);
        }
        else {
          self.combineChunks(file, uuid, function() {
            console.log("Receiving upload " + file.name, uuid);
            self.handleUploadedFile(file, uuid, fields, function() {
              if(!hasFailed) {
                responseData.success = true
                res.send(responseData)
              }
            }, failure);
          }, failure);
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
          console.log("Receiving upload " + body.qqfilename, body.qquuid);
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
  isValid: function(size) {
    return this.maxFileSize === 0 || size < this.maxFileSize;
  },
  moveUploadedFile: function(file, uuid, success, failure) {
    var destinationDir = this.getUploadPath(file.group, file.sessionID, uuid),
        fileDestination = destinationDir + "/" + file.name;

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
    var destinationDir = this.getUploadPath(file.group, file.sessionID, uuid, this.chunksName),
        chunkFilename = this.getChunkFilename(index, numChunks),
        fileDestination = destinationDir + chunkFilename;

    this.moveFile(destinationDir, file.path, fileDestination, success, failure);
  },
  combineChunks: function(file, uuid, success, failure) {
    var self = this,
      chunksDir = self.getUploadPath(file.group, file.sessionID, uuid, self.chunksName),
      destinationDir = self.getUploadPath(file.group, file.sessionID, uuid),
      fileDestination = destinationDir + "/" + file.name;

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
  },
  getUploadPath: function(group, sessionID, uuid, chunks) {
    var p = this.uploadPath + group + "/" + sessionID;
    if(uuid) { p += "/" + uuid }
    if(chunks) { p += "/" + chunks + "/" }
    return p;
  },
  finalizeSessionInfoFiles: function(group, sessionID, success, failure) {
    try {
      var self = this;
      var dir = self.getUploadPath(group,sessionID);

      // move all json-part files to json files for session
      if(fs.existsSync(dir)) {
        fs.readdirSync(dir).forEach(function(uuid) {
          fs.readdirSync(dir+"/"+uuid).forEach(function(filename) {
            if(filename.endsWith(".json-part")) {
              var fp = dir+"/"+uuid+"/"+filename
              fs.renameSync(fp,fp.replace('.json-part','.json'))
            }
          })
        })
      }
      success()
    } catch(err) {
      console.warn("Error renaming json-part files", err);
      failure()
    }
  },
  getFileInfoPath: function(file, uuid) {
    // we use 'json-part' ext because the file might not be completed until after file/session handlers
    return this.getUploadPath(file.group, file.sessionID, uuid) + "/" + file.name + ".json-part";
  }
}

module.exports = Uploader;
