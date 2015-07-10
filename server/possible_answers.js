var model = require('./model');
var Puzzle = model.Puzzle;
var async = require('async');
var solr = require('solr-client');
var Enumerable = require('linq');
var client = solr.createClient('104.131.46.124', 8080, '', '/solr');

module.exports.retrieve = function(id) {
  Puzzle.findOne({ '_id' : id}, function(err, puzzle) {
    if (err) return clean_up(puzzle, err);
    async.each(
      puzzle.slots,
      function (slot, cb) {
        solr_guesses(slot.clue, slot.len, function(err, guesses) {
          if (err) {
            cb(err);
            return;
          }
          slot.guesses = guesses;
          slot.save(function(err) {
            if (err) {
              cb(err);
            } else {
              cb(null);
            }
          });
        })
      },
      function(err) {
        if (err) {
          clean_up(puzzle, err);
        } else {
          puzzle.answers_status = "success";
          puzzle.save();
        }
      }
    );
  });
}

function solr_guesses(clue, length, cb) {
  var clue_query = clue.split(/[\s-]+/).map(function (str) {
    return str.trim().replace(/[^a-z0-9]/gi,'');
  }).filter(function (str) {
    return str.length >= 2;
  }).join("|");
  if (clue_query.length==0) {
    cb(null, {});
    return;
  }
  var query_str = "length:" + length + " AND " + "clue:" + clue_query;
  var query = client.createQuery().q(query_str).restrict('score').start(0).rows(100);
  client.search(query, function(err, obj) {
    if(err){
      cb(err, null);
    } else {
      var guesses = obj.response.docs.map(function (doc) {
        return {name: doc.answer, conf: doc.score};
      });

      //reduce guesses down: http://stackoverflow.com/questions/14446511/what-is-the-most-efficient-method-to-groupby-on-a-javascript-array-of-objects
      var grouped_guesses =
        Enumerable.from(guesses).groupBy(function(x){ return x.name; })
          .select(function(x){
            return {
              name: x.key(),
              conf: x.max(function(y){ return y.conf; })
            };
          }).toArray();

      grouped_guesses.sort(function(guess1, guess2) {return guess2.conf - guess1.conf;})
      grouped_guesses = grouped_guesses.slice(0,15);
      cb(null, grouped_guesses);

     }
  });
}

function clean_up(puzzle, err) {
  console.log(err);
  puzzle.answers_status = "failure";
  puzzle.save();
}
