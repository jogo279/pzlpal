var model = require('./model');
var Puzzle = model.Puzzle;
var cp = require('child_process');
var fs = require('fs');
var http = require('http');
var sizeOf = require('image-size');
var async = require('async');
var request = require('request');

module.exports.digitize = function(id, crop_width, crop_height, across_coords, down_coords) {
  Puzzle.findOne({ '_id' : id}, function(err, puzzle) {
    if (err) return clean_up(puzzle, err);

    // Set up workspace
    var dir = process.env.PZL_TMP + id + '/';
    fs.mkdir(dir, function(err) {
      if (err && err.code != 'EEXIST') {
        return clean_up(puzzle, err);
      } 

      // Download the image
      download(puzzle.imageURL, dir + 'original.jpg', function() {
        // Identify the grid
        var find_grid = cp.exec(
          "python server/find_grid.py " + dir + "original.jpg " + puzzle.gridWidth + " " + puzzle.gridHeight + " 0",
          function (err, stdout, stderr) {
            if (err) return clean_up(puzzle, err);
            var grid = stdout.split("\n").map(function(row) {
              return row.split(" ")
                .filter(function (str) {return str != ""})
                .map(function (str) { return + str });
            }).filter(function (arr) { return arr.length == puzzle.gridWidth });
            
            if (grid.length != puzzle.gridHeight) {
              // TODO: why not just throw the error?
              return clean_up(puzzle, new Error("find_grid output doesn't match grid height"));
            }

            // Build slots
            var slot_num = 1;
            var slots = [];
            var across_slot_nums = [];
            var down_slot_nums = [];
            for (var i = 0; i < grid.length; i++) {
              for (var j = 0; j < grid[i].length; j++) {
                var new_slot = false;

                // Is this the start of a new across?
                if (grid[i][j] == 1 && (j==0 || grid[i][j-1]==0) && (j != grid[i].length-1 && grid[i][j+1]==1)) {
                  // Find slot length
                  var crawl = j;
                  while (crawl < grid[i].length && grid[i][crawl] == 1) crawl++;
                  var length = crawl-j;
                  slots.push({
                    starty : i+1,
                    startx : j+1,
                    len : length,
                    orientation : "across",
                    position : slot_num
                  });
                  new_slot = true;
                  across_slot_nums.push(slot_num);
                }

                // Is this the start of a new down?
                if (grid[i][j] == 1 && (i==0 || grid[i-1][j]==0) && (i != grid.length-1 && grid[i+1][j]==1)) {
                  // Find slot length
                  var crawl = i;
                  while (crawl < grid.length && grid[crawl][j] == 1) crawl++;
                  var length = crawl-i;
                  slots.push({
                    starty : i+1,
                    startx : j+1,
                    len : length,
                    orientation : "down",
                    position : slot_num
                  });
                  new_slot = true;
                  down_slot_nums.push(slot_num);
                }

                if (new_slot) slot_num++;
              }
            }

            get_text(puzzle._id, across_coords, down_coords, crop_width, crop_height, function(err, text) {
              if (err) return clean_up(puzzle, err);

              // Split up text into clues
              var across_clues = get_clues(text.across, across_slot_nums);
              var down_clues = get_clues(text.down, down_slot_nums);

              // Add clues to slots and save
              slots.forEach(function(slot) {
                if (slot.orientation == "across") {
                  slot.clue = across_clues[slot.position];
                } else {
                  slot.clue = down_clues[slot.position];
                }
              });
              Puzzle.update({_id: id}, {'$set': {
                'status': 'success',
                'slots': slots
              }}, function(err) {
                if (err) {
                  console.log(err.stack);
                } else {
                  console.log("Success");
                }
              });
            });
        });
      });
    });
  });
}

function get_text(id, across_coords, down_coords, crop_width, crop_height, cb) {
  // limit to 10 images each
  across_coords = across_coords.slice(0, 10);
  down_coords = down_coords.slice(0, 10);

  // Clean image
  var dir = process.env.PZL_TMP + id + '/';
  var clean_image = cp.exec(
    "cp " + dir + "original.jpg " + dir + "clean.jpg",
    function (err, stdout, stderr) {
      if (err) {
        console.log(err);
        return;
      }

      // Get image dimensions and stretch coordinates based on difference between crop dimensions and real dimensions
      sizeOf(dir + "clean.jpg", function(err, dimensions) {
        var real_width = dimensions.width;
        var real_height = dimensions.height;
        across_coords = across_coords.map(function (coords, idx) {
          return {
            x : coords.x * real_width / crop_width,
            y : coords.y * real_height / crop_height,
            x2 : coords.x2 * real_width / crop_width,
            y2 : coords.y2 * real_height / crop_height,
            w : coords.w * real_width / crop_width,
            h : coords.h * real_height / crop_height,
            orientation : "across",
            idx: idx
          }
        });
        down_coords = down_coords.map(function (coords, idx) {
          return {
            x : coords.x * real_width / crop_width,
            y : coords.y * real_height / crop_height,
            x2 : coords.x2 * real_width / crop_width,
            y2 : coords.y2 * real_height / crop_height,
            w : coords.w * real_width / crop_width,
            h : coords.h * real_height / crop_height,
            orientation : "down",
            idx: idx
          }
        });

        // Extract subimages and then the text
        var across_text_arr = Array(across_coords.length);
        var down_text_arr = Array(down_coords.length);
        async.each(
          across_coords.concat(down_coords), 
          function (coords, cb) {
            var image_name = coords.orientation + "-" + coords.idx;
            var extract_text = cp.exec(
              "convert -extract " + coords.w + "x" + coords.h + "+" + coords.x + "+" + coords.y + " " + dir + "clean.jpg " + dir + image_name + ".jpg" +
              " && tesseract " + dir + image_name  + ".jpg " + dir + image_name + " -l eng -psm 6" +
              " && cat " + dir + image_name + ".txt ",
              function (err, stdout, stderr) {
                if (err) {
                  cb(err);
                  return;
                }

                if (coords.orientation == "across") {
                  across_text_arr[coords.idx] = stdout;
                } else {
                  down_text_arr[coords.idx] = stdout;
                }

                cb(null);

              });
          },
          function (err) {
            if (err) {
              cb(err, null);
            } else {
              cb(null, {
                across : across_text_arr.join("\n"),
                down : down_text_arr.join("\n")
              });
            }
          });
      });
  });
}


// TODO: assume clues are in order
function get_clues(text, numbers) {
  var clues = [];
  var current_clue_num = -1;
  var current_count = 0;
  var current_clue = "";
  
  var text_arr = text.split("\n").map(function (str) { return str.trim() });
  for (var i = 0; i < text_arr.length; i++) {
    var str = text_arr[i];
    if (str == "") {
      continue;
    }
    var split = split_clue(str);
    var next_clue_num = split.nbr;
    var new_str = split.str;

    if (numbers.indexOf(next_clue_num) == -1) {
      next_clue_num = -1;
    }
    if (next_clue_num > 0 || current_count >= 5) {
      if (current_clue_num > 0) {
        clues[current_clue_num] = current_clue;
      }
      current_clue = new_str;
      current_count = 0;
      current_clue_num = next_clue_num;
    } else {
      current_clue += " " + new_str;
      current_count++;
    }
  }
  if (current_clue_num > 0) {
    clues[current_clue_num] = current_clue;
  }
  return clues;
}

function split_clue(str) {
  digits = str.substring(0, 3).split("").map(function (str) { return is_digit(str) });
  if (digits[0] && digits[1] && digits[2]) {
    return {
      nbr: parseInt(str.substring(0, 3)),
      str: str.substring(3, str.length).trim()
    };
  } else if (digits[0] && digits[1]) {
    return {
      nbr: parseInt(str.substring(0, 2)),
      str: str.substring(2, str.length).trim()
    };
  } else if (digits[0]) {
    return {
      nbr: parseInt(str.substring(0, 1)),
      str: str.substring(1, str.length).trim()
    };
  } else {
    return {
      nbr: -1,
      str: str.trim()
    };
  }

}

function is_digit(str) {
  var digits = Array("0", "1", "2", "3", "4", "5", "6", "7", "8", "9");
  return digits.indexOf(str) >= 0;
}


/* http://stackoverflow.com/questions/18052762/remove-directory-which-is-not-empty */
function remove_folder(location, next) {
    fs.readdir(location, function (err, files) {
        async.each(files, function (file, cb) {
            file = location + '/' + file
            fs.stat(file, function (err, stat) {
                if (err) {
                    return cb(err);
                }
                if (stat.isDirectory()) {
                    removeFolder(file, cb);
                } else {
                    fs.unlink(file, function (err) {
                        if (err) {
                            return cb(err);
                        }
                        return cb();
                    })
                }
            })
        }, function (err) {
            if (err) return next(err)
            fs.rmdir(location, function (err) {
                return next(err)
            })
        })
    })
}

function clean_up(puzzle, err) {
  console.log(err);
  puzzle.status = "failure";
  puzzle.save();
  remove_folder(process.env.PZL_TMP + puzzle._id + '/', function(err) { console.log(err)});
  return;
}

function download(uri, filename, callback){
  request.head(uri, function(err, res, body){
    console.log('content-type:', res.headers['content-type']);
    console.log('content-length:', res.headers['content-length']);
    if (res.headers['content-length'] > 20000000) {
      throw new Error("File over 20MB.");
    }

    request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
  });
};