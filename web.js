var express = require("express")
var logfmt = require("logfmt")
var url = require('url')
var map = require('through2-map')
var querystring = require ('querystring')
var https = require('https');
var app = express();
var MongoClient = require('mongodb').MongoClient;
var mongoUri = process.env.MONGOLAB_URI || 
	process.env.MONGOHQ_URL ||
	'mongodb://localhost/pmc_db';
app.use(logfmt.requestLogger());

app.get('/', function(req, res) {
  res.send('Hello fool!');
});


function get_pmc(user_name)
{
	var pmc;
	MongoClient.connect(mongoUri, function (err, db) {
		if (err) {console.log("error connecting to db"); return console.dir(err);};
		var collection = db.collection('pmc');
		pmc = collection.find(
		{
			"name" : "boltar"
		})

		console.log("get_pmc:" + pmc);
	});
	return pmc;
}

function store_pmc(user_name, time_stamp, pmc, notes)
{
	// todo: connection manager
	MongoClient.connect(mongoUri, function (err, db) {
		if (err) {console.log("error connecting to db"); return console.dir(err);};
		var collection = db.collection('pmc');
		collection.insert( 
			{'time_stamp' : time_stamp,
			'name': user_name,
			'p' : pmc.slice(0,1),
			'm' : pmc.slice(1,2),
			'c' : pmc.slice(2,3),
			'notes' : notes}, function(err, db) {
				console.log("inserted " + pmc + " for " + user_name);
				PostToSlack(user_name + ' posted pmc: ' + pmc);
			});
	});
};

function undo_pmc(user_name) {
	MongoClient.connect(mongoUri, function (err, db) {
		if (err) {console.log("error connecting to db"); return console.dir(err);};
		var collection = db.collection('pmc');
		collection.findAndModify(
			{name: user_name},
			[['time_stamp', -1]],
			{},
			{remove: true}, function(err, doc) {
				console.log("removed entry for " + user_name);
		});
	});
};



app.post('/pmc', function(req, res) {
	req.pipe(map(function (chunk) {
		parsed = querystring.parse(chunk.toString())
		console.log(parsed)
		user_name = parsed['user_name'];
		text = parsed['text'];
		timestamp = parsed['timestamp'];
		date = new Date(parseInt(parsed['timestamp']) * 1000)

		console.log('user ' + user_name + ' said ' 
			+ text + ' at ' + date.toString());

		if (text.slice(4,8) === 'undo') {
			undo_pmc(user_name);
		} else if (/[0-9xX]{3}/.exec(text.slice(4,7)) != null) {
			store_pmc(user_name,
				timestamp, 
				text.slice(4,7), // pmc
				text.slice(8, text.length));
			return chunk.toString()
		} else {
			console.log("error parsing string");
		}
	})).pipe(res)
})

// app.post('/getpmc', function(req, res) {
// 	req.pipe(map(function (chunk) {
// 		parsed = querystring.parse(chunk.toString())
// 		console.log(parsed)
// 		user_name = parsed['user_name'];
// 		text = parsed['text'];
// 		timestamp = parsed['timestamp'];
// 		date = new Date(parseInt(parsed['timestamp']) * 1000)

// 		console.log('user ' + user_name + ' said ' 
// 			+ text + ' at ' + date.toString());

// 		pmc = get_pmc(user_name); //<<--- this is non-blocking!
// 		console.log('pmc:' + pmc);

// 		PostToSlack(pmc);
// 	})).pipe(res)
// })

var port = Number(process.env.PORT || 5000);
app.listen(port, function() {
  console.log("Listening on " + port);

});


function PostToSlack(post_text) {
  // Build the post string from an object

  post_data = JSON.stringify(
  	{"text" : post_text, 
  	 "username" : "pmcbot",
  	 "icon_emoji" : ":pmcbot:"
  	})

  
  console.log(post_text)

  // An object of options to indicate where to post to
  var post_options = {
      host: 'poundc.slack.com',
      port: '443',
      path: '/services/hooks/incoming-webhook?token=w0kPrJC0eVqAAnYz7h15yaEh',
      method: 'POST',
      headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': post_data.length
      }
  };

  // Set up the request
  var post_req = https.request(post_options, function(res) {
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
          console.log('Response: ' + chunk);
      });
  });
  console.log("POST data: " + post_data);

  post_req.write(post_data);
  post_req.end();
}
