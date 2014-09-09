var express = require("express")
var logfmt = require("logfmt")
var url = require('url')
var map = require('through2-map')
var querystring = require ('querystring')
var bodyParser = require('body-parser')
var mongoskin = require('mongoskin')
var https = require('https');
var app = express();
var MongoClient = require('mongodb').MongoClient;
var mongoUri = process.env.MONGOLAB_URI || 
	process.env.MONGOHQ_URL ||
	'mongodb://localhost/pmc_db';

var db = mongoskin.db(mongoUri, {safe:true})

//app.use(express.static('public'));
var hbs = require('hbs')
var blogEngine = require('./blog');
app.set('view engine', 'html');
app.engine('html', hbs.__express);
app.use(logfmt.requestLogger());
app.use(bodyParser.urlencoded({
  extended: true
}));

app.param('collectionName', function(req, res, next, collectionName){
  req.collection = db.collection(collectionName)
  return next()
})

app.param('name', function(req, res, next, name) {
  db.collection("pmc")
  	.find({"name" : name}, {})
  	.toArray(function(e, results){
  		if (e) return next(e);
//  		res.send(results)

	for (i = 0; i < results.length; ++i) {
		d = new Date(results[i].time_stamp*1000)
		results[i].time_stamp = d;
		console.log(d)
    }

	res.render('user_stats', 
  		{title: "PMC for " + name,
  		 "name": name,
  	     entries: results});

		return next();
  	})
})

app.get('/', function(req, res) {
  res.render('index', {title: "PMC charter"})
});

app.get('/collections/:collectionName', function(req, res, next) {
  req.collection.find({} ,{limit:50, sort: [['_id',-1]]}).toArray(function(e, results){
    if (e) return next(e)
    res.send(results)
  })
})

//app.get('/user/:name', function(req, res, next) {
//})

app.get('/user/:name', function(req, res, next) {
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