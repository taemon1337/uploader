var express = require("express")
  , app = express()
  , request = require('request')
  , Uploader = require('./lib/uploader')
  , uploader = Uploader({})
  , publicDir = process.env.PUBLIC_DIR || 'web'
  , nodeModulesDir = process.env.NODE_MODULES_DIR || '/node_modules/'
  , port = process.env.SERVER_PORT || 8080
  , API = process.env.API || "http://api:8080"
;

uploader.addFileHandler(require('./lib/info-handler'))
uploader.addFileHandler(require('./lib/hash-handler'))
uploader.addFileHandler(require('./lib/eve-uploader'))

app.use(express.static(publicDir));
app.use("/fine-uploader", express.static(nodeModulesDir+'fine-uploader/fine-uploader'));
app.use("/templates", express.static("./templates"));

app.all('/api*', function(req, res) {
  req.pipe(request(API+req.originalUrl)).pipe(res);
});


uploader.mount(app)
app.listen(port);
