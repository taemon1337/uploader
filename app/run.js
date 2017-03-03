var express = require("express")
  , app = express()
  , request = require('request')
  , Uploader = require('./lib/uploader')
  , publicDir = process.env.PUBLIC_DIR || 'web'
  , inbox_data = process.env.INBOX_DATA || '/uploads/'
  , nodeModulesDir = process.env.NODE_MODULES_DIR || '/node_modules/'
  , port = process.env.SERVER_PORT || 8080
;

var uploader = Uploader({ uploadPath: inbox_data })

uploader.addFileHandler(require('./lib/info-handler'))
uploader.addFileHandler(require('./lib/hash-handler'))
uploader.addSessionHandler(require('./lib/archive-handler'))

app.use(express.static(publicDir));
app.use("/fine-uploader", express.static(nodeModulesDir+'fine-uploader/fine-uploader'));

uploader.mount(app)
app.listen(port);
console.log("Uploader: ", {
  publicDir: publicDir,
  inbox_data: inbox_data,
  nodeModulesDir: nodeModulesDir
})
