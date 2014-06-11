//var mongo = require('mongodb');
var mongoUri = process.env.MONGOLAB_URI || 
	process.env.MONGOHQ_URL ||
	'mongodb://localhost';

// Retrieve
var MongoClient = require('mongodb').MongoClient;

// Connect to the db
MongoClient.connect("mongodb://localhost/exampleDb", function(err, db) {
  if(err) { console.log("error"); return console.dir(err); }
  var collection = db.collection('test');
  var doc1 = {'hello':'doc1'};
  var doc2 = {'hello':'doc2'};
  var lotsOfDocs = [{'hello':'doc3'}, {'hello':'doc4'}];

  collection.insert(doc1);

  collection.insert(doc2, {w:1}, function(err, result) {});

  collection.insert(lotsOfDocs, {w:1}, function(err, result) {});

});