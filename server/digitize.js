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
    var dir = 'public/images/' + id + '/';
    fs.mkdir(dir, function(err) {
      if (err && err.code != 'EEXIST') return clean_up(puzzle, err);

      // Download the image
      download(puzzle.imageURL, dir + 'original', function(err) {
        if (err) return clean_up(puzzle, err);

        // Find slots
        get_slots(dir + 'original.png', puzzle.gridWidth, puzzle.gridHeight, function(err, slots, across_slot_nums, down_slot_nums) {
          if (err) return clean_up(puzzle, err);

          // Build clues image
          build_clues_image(puzzle._id, across_coords, down_coords, crop_width, crop_height, function(err, text) {
            if (err) return clean_up(puzzle, err);

            // Get text from image
            get_text(puzzle._id, function(err, text) {
              if (err) return clean_up(puzzle, err);

              // Split up text into clues
              get_clues(text, across_slot_nums, down_slot_nums, function (err, across_clues, down_clues) {
                if (err) return clean_up(puzzle, err);

                // Add clues to slots and save
                slots.forEach(function(slot) {
                  if (slot.orientation == "across") {
                    slot.clue = across_clues[slot.position];
                    if (slot.clue == null) {
                      slot.clue = "";
                    }
                  } else {
                    slot.clue = down_clues[slot.position];
                    if (slot.clue == null) {
                      slot.clue = "";
                    }
                  }
                });
                Puzzle.update({_id: id}, {'$set': {
                  'digitizing_status': 'success',
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
    });
  });
}



/* Given an image, uses find_grid.py to find the puzzle grid in the image, then determines all of the slots by
 * assuming standard crossword numbering. */
function get_slots(file, width, height, cb) {
  cp.exec(
    "python server/find_grid.py " + file + " " + width + " " + height,
    function (err, stdout, stderr) {
      if (err) {
        cb(err, null, null, null);
        return;
      }
      var grid = stdout.split("\n").map(function(row) {
        return row.split(" ")
          .filter(function (str) {return str != ""})
          .map(function (str) { return + str });
      }).filter(function (arr) { return arr.length == width });
            
      if (grid.length != height) {
        cb(new Error("find_grid output doesn't match grid height"), null, null, null);
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
      cb(null, slots, across_slot_nums, down_slot_nums);
    });
}


/* Given crop data from user, construct a single image containing only the clues via ImageMagick */
function build_clues_image(id, across_coords, down_coords, crop_width, crop_height, cb) {
  // limit to 10 images each
  across_coords = across_coords.slice(0, 10);
  down_coords = down_coords.slice(0, 10);

  var dir = 'public/images/' + id + '/';
  // Get image dimensions and stretch coordinates based on difference between crop dimensions and real dimensions
  sizeOf(dir + 'original.png', function(err, dimensions) {
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

    // Build image for each piece
    async.each(
      across_coords.concat(down_coords),
      function (coords, cb) {
        var image_name = coords.orientation + "-" + coords.idx;
        cp.exec(
           "convert -extract " + coords.w + "x" + coords.h + "+" + coords.x + "+" + coords.y + " " + dir + 'original.png '  + dir + image_name + ".jpg",
           function (err, stdout, stderr) {
            if (err) {
              cb(err);
              return;
            }
            cb(null);
           }
        );
      },
      function (err) {
        if (err) {
          cb(err);
          return;
        }

        // Combine the images
        cp.exec(
          "convert " + dir + "across-*.jpg -append " + dir + "across.jpg &&" +
          "convert " + dir + "down-*.jpg -append " + dir + "down.jpg &&" +
          "convert " + dir + "across.jpg " + dir + "down.jpg -append " + dir + "clues.jpg",
          function (err, stdout, stderr) {
            cb(err);
          }
        );
      }
    );
  });
}

/* Extract text from an image. First tries NewOCR, and then tesseract if that fails. */
function get_text(id,  cb) {
  var dir = 'public/images/' + id + '/';
  request.post({
    url: 'http://api.newocr.com/v1/upload?key=' + process.env.NEWOCR_KEY,
    formData: {
      file: fs.createReadStream(dir + "clues.jpg")
    }
  }, function(err, response, body) {
    if (err || response.statusCode != 200) {
      console.log("NewOCR Failed on " + file + ". Trying Tesseract.");
      cp.exec(
        "tesseract " + dir + " clues.jpg " + dir + "clues -l eng -psm 6 && cat " + dir + "clues.txt",
        function(err, stdout, stderr) {
          if (err) {
            cb(new Error("Bad OCR Response"), null);
          } else {
            cb (null, stdout);
          }
        }
      );
    } else {
      var file_id = JSON.parse(body).data.file_id;
      request.get('http://api.newocr.com/v1/ocr?key=' + process.env.NEWOCR_KEY + '&page=1&lang=eng&psm=6&file_id=' + file_id, 
        function(err, response, body) {
          cb(null, JSON.parse(body).data.text);
        });
    }
  });
}

/* Divides up text into clues by parsing the numbers in the text. */
function get_clues(text, across_numbers, down_numbers, cb) {
  var look_ahead = 5, allow_across = true, allow_down = false;
  var across_cutoff = across_numbers[Math.floor(across_numbers.length*.8)];
  var down_cutoff = down_numbers[Math.floor(down_numbers.length*.3)];
  var across_clues = [], down_clues = [];
  var current = {
    num: -1,
    lines: 0,
    clue: "",
    orientation: "across"
  };
  var text_arr = text.split("\n").map(function (str) { return str.trim() });
  for (var i = 0; i < text_arr.length; i++) {
    var str = text_arr[i];

    // try across
    var success = false;
    if (allow_across) {
      for (var j = 0; j < look_ahead; j++) {
        if (j >= across_numbers.length) break;
        if (similar_to(across_numbers[j], str)) {
          if (current.num > 0) {
            if (current.orientation == "across") {
              across_clues[current.num] = current.clue;
            } else {
              down_clues[current.num] = current.clue;
            }
          }
          current = {
            num: across_numbers[j],
            lines: 1,
            clue: extract_num(str, across_numbers[j]),
            orientation: "across"
          };
          if (across_numbers[j] >= across_cutoff) allow_down = true;
          across_numbers.splice(j,1);
          success = true;
          break;
        }
      }
    }

    // if not, try down
    if (!success && allow_down) {
      for (var j = 0; j < look_ahead; j++) {
        if (j >= down_numbers.length) break;
        if (similar_to(down_numbers[j], str)) {
          if (current.num > 0) {
            if (current.orientation == "across") {
              across_clues[current.num] = current.clue;
            } else {
              down_clues[current.num] = current.clue;
            }
          }
          current = {
            num: down_numbers[j],
            lines: 1,
            clue: extract_num(str, down_numbers[j]),
            orientation: "down"
          };
          if (down_numbers[j] > down_cutoff) allow_across = false;
          down_numbers.splice(j,1);          
          success = true;
          break;
        }
      }
    }

    if (success) {
      look_ahead = 5;
    } else {
      //if (look_ahead < 10) 
      look_ahead++;
      current.lines++;
      current.clue += " " + str.trim();
      if (current.lines >= 5 && current.num > 0) {
        if (current.orientation == "across") {
          across_clues[current.num] = current.clue;
        } else {
          down_clues[current.num] = current.clue;
        }
        current = {
          num: -1,
          lines: 0,
          clue: "",
          orientation: "across"
        };
      }
    }
  }
  if (current.num > 0) {
    if (current.orientation == "across") {
      across_clues[current.num] = current.clue;
    } else {
      down_clues[current.num] = current.clue;
    }
  }

  cb(null, across_clues, down_clues);
}

/* Remove number from beginning of string */
function extract_num(str, num) {
  var len = num.toString().length;
  var trim = str.trim();
  var extracted = trim.substr(len, trim.length).trim();
  if (extracted[0] == '.') return extracted.substr(1, extracted.length).trim();
  return extracted;
}

/* Check if string starts with something like the number. */
function similar_to(num, str) {
  var digits = num.toString().split('');
  var chars = str.replace(/\s+/g, '').split('');
  if (chars.length < digits.length) return false;
  for (var i = 0; i < digits.length; i++) {
    var c = chars[i];
    if (c==digits[i]) continue;
    switch (digits[i]) {
      case '0':
        if (c!='o' && c!='O') return false;
        break;
      case '1':
        if (c!='i' && c!='I' && c!='[' && c!= ']' && c!= '|' && c!='l' && c!="'") return false;
        break;
      case '5':
        if (c!='S') return false;
        break;
      case '9':
        if (c!='g') return false;
        break;
      default:
        return false;
        break;
    }
  }
  return true;
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
  puzzle.digitizing_status = "failure";
  puzzle.save();
  //remove_folder('public/images/' + puzzle._id + '/', function(err) { console.log(err)});
  return;
}

function extension(uri) {
  return "." + uri.split(".").pop();
}

function download(uri, filename, cb){
  var ext = extension(uri);
  if (ext!= ".jpg" && ext != ".png" && ext != ".gif" && ext != ".bmp") {
    cb(new Error("Wrong file type"));
    return;
  }
  request.head(uri, function(err, res, body){
    if (res.headers['content-length'] > 20000000) {
      cb(new Error("File over 20MB."));
    } else {
      request(uri).pipe(fs.createWriteStream(filename + ext)).on('close', function() {
        cp.exec(
           "convert " + filename + ext + " " + filename + ".png",
           function (err, stdout, stderr) {
            if (err) {
              cb(err);
              return;
            }
            cb(null);
           }
        );
      });
    }
  });
};