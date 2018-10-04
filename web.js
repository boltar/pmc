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
//var urban = require('urban')

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0


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
//https://en.wiktionary.org/w/api.php?format=json&action=query&rvprop=content&prop=extracts&redirects=1&explaintext&titles=Godspeed

function toTitleCase(str)
{
    return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}

function encode_utf8(s) {
  return unescape(encodeURIComponent(s));
}

if (typeof String.prototype.startsWith != 'function') {
  // see below for better implementation!
  String.prototype.startsWith = function (str){
    return this.indexOf(str) == 0;
  };
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
    var w;
    try {
    	w = JSON.parse(str);
    }
    catch (err) {
    	console.log("Error parsing JSON string: " + str)
    	PostToSlack("Wiki error: " + str, "--", ":urbot:");
    	options.path = '';
    	return
    }

    w = JSON.parse(str);
    for (prop in w.query.pages) {
    	e = w.query.pages[prop].extract;
      e += "  http://en.wikipedia.org/wiki/" + w.query.pages[prop].title.replace(/ /g, '_');
    	//e = utf8.encode(e);
    	if (typeof e != 'undefined')
    	{
    		console.log('wiktor_cb: ' + e);
    		console.log('-2-');
    		PostToSlack(e, "--", ":wiktor:");
    	}
    	else
    	{
    		PostToSlack("Query failed", "--", ":wiktor:");
    	}
    }
    options.path = '';
  });
}



app.post('/wiktor', function(req, res) {
	req.pipe(map(function (chunk) {
		parsed = querystring.parse(chunk.toString())
//		console.log('app.post(/wiktor): ' + parsed)
		user_name = parsed['user_name'];
		text = parsed['text'];
		timestamp = parsed['timestamp'];
		date = new Date(parseInt(parsed['timestamp']) * 1000)

		console.log('user ' + user_name + ' said '
			+ text + ' at ' + date.toString());

		if (text.startsWith('!wiki ')){
			wiki_entry = text.slice('!wiki '.length, text.length);
		} else if (text.startsWith('teh x is '))
		{
			wiki_entry = text.slice('teh x is '.length, text.length);
		}

		//wiki_entry = toTitleCase(wiki_entry);
		wiki_entry = wiki_entry.replace(/ /g, '_');
		console.log('wiki_entry: ' + wiki_entry);
		options.path = path_const + wiki_entry;
		https.request(options, wiktor_cb).end();
	})).pipe(res)
})
// end wiki stuff

/// wiktionary stuff
var options_wikt = {
  host: 'en.wiktionary.org',
  path: ''
};

//http://en.wiktionary.org/w/api.php?action=query&prop=extracts&format=json&redirects&explaintext&exintro&titles=
var wikt_path_const = '/w/api.php?action=query&prop=extracts&format=json' +
  '&redirects&explaintext&titles=';

function toTitleCase(str)
{
    return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}

function encode_utf8(s) {
  return unescape(encodeURIComponent(s));
}

if (typeof String.prototype.startsWith != 'function') {
  // see below for better implementation!
  String.prototype.startsWith = function (str){
    return this.indexOf(str) == 0;
  };
}


const anysection_rege = /(={2,} .*? ={2,})/g;
const ety_section = /={3,} Etymology (\d )?={3,}/
const pro_section = /={3,} Pronunciation (\d )?={3,}/
const double_section = /^n={2} .*? ={2,}/

function find_wikt_section(heading, str)
{
	arr = str.split(anysection_rege);
	var result = [];
	var unique_headings = [];
	var started = 0;
	// does the heading exist?
	for (s of arr) {
		console.log("s: " + s);
		if (started && anysection_rege.exec(s) && double_section.exec(s))
		{
			break;
		}

		if (heading.exec(s))
		{
			if (unique_headings.indexOf(s) == -1)
			{
				// add unique headings
				unique_headings.push(s);
				// since it was a unique heading, add it to results
				result.push(arr[arr.indexOf(s)+1]);
				started = 1;
			}
		}
	}
	return result;
}

var def_emojis = [":zero:", ":one:", ":two:", ":three:", ":four:", ":five:", ":six:"]

wiktionary_cb_ety = function(response) {
  var str = '';

  response.setEncoding('')
  //another chunk of data has been recieved, so append it to `str`
  response.on('data', function (chunk) {
    str += chunk;
  });

  //the whole response has been received, so we just print it out here
  response.on('end', function () {
    console.log('wiktionary_cb: ' + str);
    console.log('-1-');
    //var ic = new iconv.Iconv('utf-8', 'utf-8')
    var w;
    try {
      w = JSON.parse(str);
    }
    catch (err) {
      console.log("Error parsing JSON string: " + str)
      PostToSlack("Wiktionary error: " + str, "--", ":urbot:");
      options_wikt.path = '';
      return
    }

    w = JSON.parse(str);
    for (prop in w.query.pages) {
      e = w.query.pages[prop].extract;
      e = find_wikt_section(ety_section, e)

      if (typeof e != 'undefined')
      {
				slackStr = '';
				var displayIndex = 1;
				for (s in e)
				{
					  if (e[s].trim() != '')
						{
							slackStr += def_emojis[displayIndex++] + " " + e[s].trim() + '\n\n'
						}
						console.log ("s:---> " + e[s].trim());
				}

        slackStr += "  http://en.wiktionary.org/wiki/" + w.query.pages[prop].title.replace(/ /g, '_');
        console.log('wiktionary_cb: ' + e);
        console.log('-2-');
        PostToSlack(slackStr, "--", ":wiktionary:");
      }
      else
      {
        PostToSlack("Query failed", "--", ":wiktionary:");
      }
    }
    options_wikt.path = '';
  });
}

wiktionary_cb_pro = function(response) {
  var str = '';

  response.setEncoding('')
  //another chunk of data has been recieved, so append it to `str`
  response.on('data', function (chunk) {
    str += chunk;
  });

  //the whole response has been received, so we just print it out here
  response.on('end', function () {
    console.log('wiktionary_cb_pro: ' + str);
    console.log('-1-');
    //var ic = new iconv.Iconv('utf-8', 'utf-8')
    var w;
    try {
      w = JSON.parse(str);
    }
    catch (err) {
      console.log("Error parsing JSON string: " + str)
      PostToSlack("Wiktionary error: " + str, "--", ":urbot:");
      options_wikt.path = '';
      return
    }

    w = JSON.parse(str);
    for (prop in w.query.pages) {
      e = w.query.pages[prop].extract;
      e = find_wikt_section(pro_section, e)

      if (typeof e != 'undefined')
      {
				slackStr = '';
				var displayIndex = 1;
				for (s in e)
				{
					  if (e[s].trim() != '')
						{
							slackStr += def_emojis[displayIndex++] + " " + e[s].trim() + '\n\n'
						}
						console.log ("s:---> " + e[s].trim());
				}

        slackStr += "  http://en.wiktionary.org/wiki/" + w.query.pages[prop].title.replace(/ /g, '_');
        console.log('wiktionary_cb: ' + e);
        console.log('-2-');
        PostToSlack(slackStr, "--", ":wiktionary:");
      }
      else
      {
        PostToSlack("Query failed", "--", ":wiktionary:");
      }
    }
    options_wikt.path = '';
  });
}



app.post('/wiktionary', function(req, res) {
  req.pipe(map(function (chunk) {
    parsed = querystring.parse(chunk.toString())
//    console.log('app.post(/wiktor): ' + parsed)
    user_name = parsed['user_name'];
    text = parsed['text'];
    timestamp = parsed['timestamp'];
    date = new Date(parseInt(parsed['timestamp']) * 1000)

    console.log('user ' + user_name + ' said '
      + text + ' at ' + date.toString());

    opt_ety = 0; opt_pro = 0;

    if (text.startsWith('!wikt -e')){
      wikt_entry = text.slice('!wikt -e'.length, text.length);
      opt_ety = 1;
      opt_pro = 0;
    }
    else if (text.startsWith('!wikt -p'))
    {
      wikt_entry = text.slice('!wikt -p'.length, text.length);
      opt_ety = 0;
      opt_pro = 1;
    }
    else if (text.startsWith('!wikt ')){
      return;
      //wikt_entry = text.slice('!wikt '.length, text.length);
    }

    //wiki_entry = toTitleCase(wiki_entry);
    wikt_entry = wikt_entry.replace(/ /g, '_');
    console.log('wikt_entry: ' + wikt_entry);
    options_wikt.path = wikt_path_const + wikt_entry;
    if (opt_ety) {
      https.request(options_wikt, wiktionary_cb_ety).end();
    }
    else if (opt_pro) {
      https.request(options_wikt, wiktionary_cb_pro).end();
    }


  })).pipe(res)
})
// end wiktionary stuff

// URBAN DICTIONARY STUFF
//http://api.urbandictionary.com/v0/define?term=kvlt
var urbandic_options = {
	host: 'api.urbandictionary.com',
	path: '',
  word: ''
};

var urbandic_path_const = '/v0/define?term=';

urbandic_cb = function(response) {
  var str = '';

  response.setEncoding('')
  //another chunk of data has been recieved, so append it to `str`
  response.on('data', function (chunk) {
    str += chunk;
  });

  //the whole response has been received, so we just print it out here
  response.on('end', function () {
    console.log('urbandic_cb: ' + str);
    console.log('-1-');
    var w;

    try {
    	w = JSON.parse(str);
    }
    catch (err) {
    	console.log("Error parsing JSON string: " + str)
    	PostToSlack("Urban error: " + str, "--", ":urbot:");
    	urbandic_options.path = '';
      urbandic_options.word = '';
    	return
    }

    //var ic = new iconv.Iconv('utf-8', 'utf-8')
    //w = JSON.parse(str);

    var sortedList = w.list.slice();
    sortedList.sort(function(a, b) {
    	console.log("a:" + a.thumbs_up + ", b: " + b.thumbs_up)
    	return b.thumbs_up - a.thumbs_up;
    })


    var posted = 0;
    var postStr = ""

    for (entry_idx in sortedList) {
      if (sortedList[entry_idx].word != urbandic_options.word)
      {
        continue;
      }
    	e = sortedList[entry_idx].definition;
    	//e = utf8.encode(e);
    	if (typeof e != 'undefined')
    	{
    		console.log('urbandic_cb: ' + e);
    		console.log('-2-');
    		if (sortedList[entry_idx].thumbs_up > sortedList[entry_idx].thumbs_down)
    		{
    			//PostToSlack(e + " :thumbsup: " + sortedList[entry_idx].thumbs_up +
    			//"  :thumbsdown: " + sortedList[entry_idx].thumbs_down, "---", ":urbot:");
    			posted++;
      			postStr += def_emojis[posted] + " " + e + " :thumbsup: " + sortedList[entry_idx].thumbs_up +
    			"  :thumbsdown: " + sortedList[entry_idx].thumbs_down + "\n";

    		}
    	}
    	else
    	{
    		PostToSlack("Query failed", "--", ":urbot:");
    	}
    	if (posted > 2)
    		break;
    }
    if (posted == 0)
    {
      PostToSlack("Query failed", "--", ":urbot:")
    }
    PostToSlack(postStr, "--", ":urbot:");

    urbandic_options.path = '';
    urbandic_options.word = '';
  });
}


app.post('/urbandic', function(req, res) {
	req.pipe(map(function (chunk) {
		parsed = querystring.parse(chunk.toString())
//		console.log('app.post(/urbandic): ' + parsed)
		user_name = parsed['user_name'];
		text = parsed['text'];
		timestamp = parsed['timestamp'];
		date = new Date(parseInt(parsed['timestamp']) * 1000)

		console.log('user ' + user_name + ' said '
			+ text + ' at ' + date.toString());

		if (text.startsWith('!urban ')){
			urban_entry = text.slice('!urban '.length, text.length);
		}

		//urban_entry = toTitleCase(wiki_entry);
    urban_entry = escape(urban_entry)
    urbandic_options.word = urban_entry;
		urban_entry = urban_entry.replace(/ /g, '%20');
		console.log('urban_entry: ' + urban_entry);
		urbandic_options.path = urbandic_path_const + urban_entry;

		https.request(urbandic_options, urbandic_cb).end();
	})).pipe(res)
})


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
  if (typeof process.env.MONGOLAB_URI == 'undefined') {
  	// running locally via foreman
  	path_str = '/services/hooks/incoming-webhook?token=w0kPrJC0eVqAAnYz7h15yaEh'; //#testing
  } else {
  	path_str = '/services/hooks/incoming-webhook?token=mcmbhcqQpfoU2THsofvad3VA'; //#legible
  }
  var post_options = {
      host: 'poundc.slack.com',
      port: '443',
      path: path_str,
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
