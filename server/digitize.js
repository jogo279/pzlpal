var model = require('./model');
var Puzzle = model.Puzzle;
var cp = require('child_process');
var fs = require('fs');
var http = require('http');
var sizeOf = require('image-size');
var async = require('async');
var request = require('request');

module.exports.digitize = function(id) {
  Puzzle.findOne({ '_id' : id}, function(err, puzzle) {
    if (err) return clean_up(puzzle, err);

    var dir = require('./config').app_dir + '/public/images/' + id + '/';

    // Find slots
    get_slots(dir + 'original.png', puzzle.gridWidth, puzzle.gridHeight, puzzle.grid_coords, function(err, slots, across_slot_nums, down_slot_nums) {
      if (err) return clean_up(puzzle, err);

      // Build clues image
      build_clues_image(puzzle._id, puzzle.across_coords, puzzle.down_coords, function(err, text) {
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
}

/* Given an image, uses find_grid.py to find the puzzle grid in the image, then determines all of the slots by
 * assuming standard crossword numbering. */
function get_slots(file, width, height, grid_coords, cb) {
  cp.exec(
    "python " + require('./config').app_dir + "/server/find_grid.py " + file + " " + width + " " + height + " " + grid_coords.x + " " + grid_coords.y + " " + grid_coords.w + " " + grid_coords.h,
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
function build_clues_image(id, across_coords, down_coords, cb) {
  var dir = require('./config').app_dir + '/public/images/' + id + '/';
  // limit to 10 images each
  across_coords = across_coords.slice(0, 10);
  down_coords = down_coords.slice(0, 10);

  across_coords = across_coords.map(function (coords, idx) {
    return {
      x : coords.x,
      y : coords.y,
      x2 : coords.x2,
      y2 : coords.y2,
      w : coords.w,
      h : coords.h,
      orientation : "across",
      idx: idx
    }
  });
  down_coords = down_coords.map(function (coords, idx) {
    return {
      x : coords.x,
      y : coords.y,
      x2 : coords.x2,
      y2 : coords.y2,
      w : coords.w,
      h : coords.h,
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
}

/* Extract text from an image. First tries NewOCR, and then tesseract if that fails. */
function get_text(id,  cb) {
  var dir = require('./config').app_dir + '/public/images/' + id + '/';
  request.post({
    url: 'http://api.newocr.com/v1/upload?key=' + require('./config').newocr_key,
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
      request.get('http://api.newocr.com/v1/ocr?key=' + require('./config').newocr_key + '&page=1&lang=eng&psm=6&file_id=' + file_id, 
        function(err, response, body) {
          var data = JSON.parse(body).data;
          if (data) {
            cb(null, data.text);
          } else {
            cb(null, "");
          }
        });
    }
  });
}

/* Divides up text into clues by parsing the numbers in the text. */
function get_clues(text, across_numbers, down_numbers, cb) {
  var look_ahead = 10, allow_across = true, allow_down = false;
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
          look_ahead = j+9;
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
          look_ahead = j+9;        
          success = true;
          break;
        }
      }
    }

    if (!success) {
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
  if (extracted[0] == '.' || extracted[0] == ')' || extracted[0] == '-') return extracted.substr(1, extracted.length).trim();
  return extracted;
}

/* Check if string starts with something like the number. */
function similar_to(num, str) {
  var one_digit = false;
  var digits = num.toString().split('');
  var chars = str.replace(/\s+/g, '').split('');
  if (chars.length < digits.length) return false;
  for (var i = 0; i < digits.length; i++) {
    var c = chars[i];
    if (c==digits[i]) {
      one_digit = true;
      continue;
    }
    switch (digits[i]) {
      case '0':
        if (c!='o' && c!='O' && c!='6' && c!= '8') return false;
        break;
      case '1':
        if (c!='i' && c!='I' && c!='[' && c!= ']' && c!= '|' && c!='l' && c!="'") return false;
        break;
      case '5':
        if (c!='S') return false;
        break;
      case '7':
        if (c!='?') return false;
        break;
      case '8':
        if (c!='3') return false;
      case '9':
        if (c!='g') return false;
        break;
      default:
        return false;
        break;
    }
  }
  return one_digit;
}

function clean_up(puzzle, err) {
  console.log(err);
  puzzle.digitizing_status = "failure";
  puzzle.save();
  return;
}