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

// rate limit
var throttler = require('./server/throttle');

// api ---------------------------------------------------------------------
var api = require('./server/api');

// create puzzle and return the object
app.post(
  '/api/puzzles', 
  function(request, response, next) { 
    return throttler.limit(24 * 60 * 60 * 1000, 10, request, response, next);
  }, 
  multiparty, 
  api.create_puzzle
);

// get puzzle
app.get(
  '/api/puzzles/:id',
  function(request, response, next) { 
    return throttler.limit(60 * 1000, 100, request, response, next);
  },
  api.retrieve_puzzle
);

// update puzzle and get crop data
app.post(
  '/api/puzzles/:id', 
  function(request, response, next) { 
    return throttler.limit(24 * 60 * 60 * 1000, 10, request, response, next);
  },
  api.update_puzzle
);

// find possible answers
app.get(
  '/api/puzzles/answers/:id', 
  function(request, response, next) { 
    return throttler.limit(24 * 60 * 60 * 1000, 100, request, response, next);
  },
  api.get_possible_answers
);

// update clues
app.post(
  '/api/puzzles/:id/clues',
  function(request, response, next) { 
    return throttler.limit(24 * 60 * 60 * 1000, 100, request, response, next);
  },
  api.update_clues
);

// application 
app.get(
  '/', 
  function(request, response, next) { 
    return throttler.limit(60 * 1000, 100, request, response, next);
  },
  function (req, res) { 
    res.sendfile('public/index.html'); 
  }
);

// listen (start app with node server.js) ======================================
app.listen(app.get('port'));
console.log("App listening on port " + app.get('port'));
