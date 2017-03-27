
http = require('http')
var querystring = require('querystring');

var options = {
	hostname: 'localhost',
	port: 5000,
	path: '/wiktionary',
	method: 'POST'
}

date = new Date()

var post_data = [];

post_data[0] = querystring.stringify({
      'user_id' : 'U02A2NEUX',
      'user_name' : 'boltar',
      'timestamp': '1402359176.000029', //date.getTime(),
      'text' : '!wikt -p kimchi' 
  });

post_data[1] = querystring.stringify({
      'user_id' : 'U02A2NEUX',
      'user_name' : 'boltar',
      'timestamp': '1402359176.000029', //date.getTime(),
      'text' : '!wikt -e kimchi' 
  });

post_data[2] = querystring.stringify({
      'user_id' : 'U02A2NEUX',
      'user_name' : 'boltar',
      'timestamp': '1402359176.000029', //date.getTime(),
      'text' : '!wikt -e cant' 
  });

post_data[3] = querystring.stringify({
      'user_id' : 'U02A2NEUX',
      'user_name' : 'boltar',
      'timestamp': '1402359176.000029', //date.getTime(),
      'text' : '!wikt -e die' 
  });

post_data[4] = querystring.stringify({
      'user_id' : 'U02A2NEUX',
      'user_name' : 'boltar',
      'timestamp': '1402359176.000029', //date.getTime(),
      'text' : '!wikt -e the' // test common names
  });

var req = http.request(options, function(res) {
	res.setEncoding('utf8')
	res.on('data', function (chunk) {
		console.log('BODY: ' + chunk)
	})
})


req.on('error', function (e) {
	console.log('problem with request: ' + e.message)
})
req.write(post_data[0])
req.write(post_data[1])
req.write(post_data[2])
req.write(post_data[3])
req.write(post_data[4])
//req.write(post_data[1])
//req.write(post_data[2])
req.end()
