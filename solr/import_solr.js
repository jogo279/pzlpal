/* Script for importing clue database into solr */
var solr = require('solr-client');
var csv = require('csv-stream');
var fs = require('fs');
var client = solr.createClient(require('../server/config').solr_domain, require('../server/config').solr_port, '', require('../server/config').solr_path);
client.autoCommit = true;

// clues.csv should contain data from http://www.otsys.com/clue/clues.bz2

fs.createReadStream('clues/clues.csv')
    .on('error',onerror)
    .pipe(csv.createStream({
        escapeChar : '"', // default is an empty string
        enclosedChar : '"' // default is an empty string
    }))
    .on('error',onerror)
    .pipe(client.createAddStream())
    .on('error',onerror)
    .on('end',function(){
        console.log('all clues are in the database now.');
    });

// Error handler
function onerror(err){
    console.error(err);
}