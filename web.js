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

/*
function get_pmc(user_name, callback(pmc))
{
	var pmc;
	MongoClient.connect(mongoUri, function (err, db) {
		if (err) {console.log("error connecting to db"); return console.dir(err);};
		var collection = db.collection('pmc');
		pmc = collection.find(
		{
			"name" : "boltar"
		})
		callback(pmc);
		console.log("get_pmc:" + pmc);
	});
	return pmc;
}
*/
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
/*
app.post('/getpmc', function(req, res) {
	req.pipe(map(function (chunk) {
		parsed = querystring.parse(chunk.toString())
		console.log(parsed)
		user_name = parsed['user_name'];
		text = parsed['text'];
		timestamp = parsed['timestamp'];
		date = new Date(parseInt(parsed['timestamp']) * 1000)

		console.log('user ' + user_name + ' said ' 
			+ text + ' at ' + date.toString());

		pmc = get_pmc(user_name); //<<--- this is non-blocking!
		console.log('pmc:' + pmc);

		PostToSlack(pmc);
	})).pipe(res)
})
*/

/// wiki stuff
var options = {
	host: 'en.wikipedia.org',
	path: ''
};

var path_const = '/w/api.php?action=query&prop=extracts&format=json&exintro=&titles=';

callback = function(response) {
  var str = '';

  //another chunk of data has been recieved, so append it to `str`
  response.on('data', function (chunk) {
    str += chunk;
  });

  //the whole response has been recieved, so we just print it out here
  response.on('end', function () {
    console.log(str);
    console.log('-----');
    w = JSON.parse(str);
    for (prop in w.query.pages) {
    	options.path = '';
    	e = w.query.pages[prop].extract;
    	console.log(e)
    	if (e) {
	    	e = e.replace(/<b>/g, "*");
    		e = e.replace(/<\/b>/g, "*");
    		e = e.replace(/<i>/g, "_");
    		e = e.replace(/<\/i>/g, "_");
    		e = e.replace(/<p>/g, "");
    		e = e.replace(/<\/p>/g, "");
    		e = e.replace(/<ul>/g, "");
    		e = e.replace(/<\/ul>/g, "");
    		e = e.replace(/<li>/g, "");
    		e = e.replace(/<\/li>/g, "");
    	}
    	PostToSlack(e, "", ":wiktor:");
    }
  });
}
//https.request(options, callback).end(); 
/*
var htmlparser = require("htmlparser2");
var parser = new htmlparser.Parser({
    onopentag: function(name, attribs){
        if(name === "b"){
            return 
        }
    },
    ontext: function(text){
        console.log("-->", text);
    },
    onclosetag: function(tagname){
        if(tagname === "script"){
            console.log("That's it?!");
        }
    }
});
//parser.write("Xyz <script type='text/javascript'>var foo = '<<bar>>';</ script>");
//parser.end();
*/
app.post('/wiktor', function(req, res) {
	req.pipe(map(function (chunk) {
		parsed = querystring.parse(chunk.toString())
		console.log(parsed)
		user_name = parsed['user_name'];
		text = parsed['text'];
		timestamp = parsed['timestamp'];
		date = new Date(parseInt(parsed['timestamp']) * 1000)

		console.log('user ' + user_name + ' said ' 
			+ text + ' at ' + date.toString());

		options.path = path_const + text.slice(6, text.length)
		https.request(options, callback).end();
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

  
  console.log(post_text)

  // An object of options to indicate where to post to
  var post_options = {
      host: 'poundc.slack.com',
      port: '443',
      path: '/services/hooks/incoming-webhook?token=mcmbhcqQpfoU2THsofvad3VA', //#testing
      //path:   '/services/hooks/incoming-webhook?token=w0kPrJC0eVqAAnYz7h15yaEh', //#legible
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
