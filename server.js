// set up ========================
var express  = require('express');
var app      = express();                               // create our app w/ express
app.set('port', require('./server/config').node_port);
var mongoose = require('mongoose');                     // mongoose for mongodb
var morgan = require('morgan');             // log requests to the console (express4)
var bodyParser = require('body-parser');    // pull information from HTML POST (express4)
var methodOverride = require('method-override'); // simulate DELETE and PUT (express4)

// configuration =================
mongoose.connect(require('./server/config').mongo_url);     // connect to mongoDB database
app.use(express.static(__dirname + '/public'));                 // set the static files location /public/img will be /img for users
app.use(morgan('dev'));                                         // log every request to the console
app.use(bodyParser.urlencoded({'extended':'true'}));            // parse application/x-www-form-urlencoded
app.use(bodyParser.json());                                     // parse application/json
app.use(bodyParser.json({ type: 'application/vnd.api+json' })); // parse application/vnd.api+json as json
app.use(methodOverride());

multiparty = require('connect-multiparty')({uploadDir: require('./server/config').app_dir + '/public/images/', maxFilesSize: 10000000});

// define model =================
var model = require('./server/model');

// api ---------------------------------------------------------------------
var api = require('./server/api');

// create puzzle and return the object
app.post('/api/puzzles', multiparty, api.create_puzzle);

// get puzzle
app.get('/api/puzzles/:id', api.retrieve_puzzle);

// update puzzle and get crop data
app.post('/api/puzzles/:id', api.update_puzzle);

// find possible answers
app.get('/api/puzzles/answers/:id', api.get_possible_answers);

// application 
app.get('/', function (req, res) { 
    res.sendfile('public/index.html'); 
});

// listen (start app with node server.js) ======================================
app.listen(app.get('port'));
console.log("App listening on port " + app.get('port'));
