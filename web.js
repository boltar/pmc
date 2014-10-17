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
var utf8 = require('utf8');

app.get('/', function(req, res) {
  res.send('Hello fool!');
});

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
				PostToSlack(user_name + ' posted pmc: ' + pmc, "pmcbot", ":pmcbot:");
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

/// wiki stuff
var options = {
	host: 'en.wikipedia.org',
	path: ''
};

var path_const = '/w/api.php?action=query&prop=extracts&format=json' + 
	'&redirects&explaintext&exintro&titles=';

function encode_utf8(s) {
  return unescape(encodeURIComponent(s));
}

wiktor_cb = function(response) {
  var str = '';

  response.setEncoding('')
  //another chunk of data has been recieved, so append it to `str`
  response.on('data', function (chunk) {
    str += chunk;
  });

  //the whole response has been received, so we just print it out here
  response.on('end', function () {
    console.log('wiktor_cb: ' + str);
    console.log('-1-');
    //var ic = new iconv.Iconv('utf-8', 'utf-8')
    w = JSON.parse(str);
    for (prop in w.query.pages) {
    	options.path = '';
    	e = w.query.pages[prop].extract;
    	//e = utf8.encode(e);
    	console.log('wiktor_cb: ' + e);
    	console.log('-2-');

    	PostToSlack(e, "--", ":wiktor:");
    }
  });
}

app.post('/wiktor', function(req, res) {
	req.pipe(map(function (chunk) {
		parsed = querystring.parse(chunk.toString())
		console.log('app.post(/wiktor): ' + parsed)
		user_name = parsed['user_name'];
		text = parsed['text'];
		timestamp = parsed['timestamp'];
		date = new Date(parseInt(parsed['timestamp']) * 1000)

		console.log('user ' + user_name + ' said ' 
			+ text + ' at ' + date.toString());

		options.path = path_const + text.slice(6, text.length)
		https.request(options, wiktor_cb).end();
	})).pipe(res)
})
// end wiki stuff

var port = Number(process.env.PORT || 5000);
app.listen(port, function() {
  console.log("Listening on " + port);

});


function PostToSlack(post_text, bot_name, bot_emoji) {
  // Build the post string from an object

    post_data = JSON.stringify(
  	{"text" : post_text, 
  	 "username" : bot_name,
  	 "icon_emoji" : bot_emoji
  	})

	//post_data = '{"text" : "' + post_text + '", "username" : "' + bot_name + 
	//'", "icon_emoji" : "' + bot_emoji + '"}';
  
  console.log(post_text)

  // An object of options to indicate where to post to
  var post_options = {
      host: 'poundc.slack.com',
      port: '443',
      //path: '/services/hooks/incoming-webhook?token=mcmbhcqQpfoU2THsofvad3VA', //#legible
      path:   '/services/hooks/incoming-webhook?token=w0kPrJC0eVqAAnYz7h15yaEh', //#testing
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(post_data, 'utf8')
      }
  };

  // Set up the request
  var post_req = https.request(post_options, function(res) {
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
          console.log('Response: ' + chunk);
      });
  });
  console.log("PostToSlack: POST data: " + post_data);

  post_req.write(post_data);
  post_req.end();
}
