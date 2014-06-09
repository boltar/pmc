var express = require("express");
var logfmt = require("logfmt");
var url = require('url');
var app = express();

app.use(logfmt.requestLogger());

app.get('/', function(req, res) {
  res.send('Hello fool!');
});

app.get('/pmc', function(req, res) {
  console.log(url.parse(req.url))
})

var port = Number(process.env.PORT || 5000);
app.listen(port, function() {
  console.log("Listening on " + port);
});


