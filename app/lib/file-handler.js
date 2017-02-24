module.exports = function(file, uuid, success, failure, uploader) {
  var destinationDir = uploader.uploadPath + uuid + "/",
      fileDestination = destinationDir + file.name;

  console.log("moving file from " + file.path + " to " + fileDestination);
  uploader.moveFile(destinationDir, file.path, fileDestination, success, failure);
};

