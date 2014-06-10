var express = require("express")
var logfmt = require("logfmt")
var url = require('url')
var map = require('through2-map')
var querystring = require ('querystring')
var app = express();

app.use(logfmt.requestLogger());

app.get('/', function(req, res) {
  res.send('Hello fool!');
  console.log
});

app.post('/pmc', function(req, res) {
	req.pipe(map(function (chunk) {
		parsed = querystring.parse(chunk.toString())
		date = new Date(parseInt(parsed['timestamp']))
		console.log(parsed)
		console.log('user ' + parsed['user_name'] + ' said ' 
			+ parsed['text'] + ' at ' + date.toString())
		return chunk.toString()
	})).pipe(res)
})

var port = Number(process.env.PORT || 5000);
app.listen(port, function() {
  console.log("Listening on " + port);
});


