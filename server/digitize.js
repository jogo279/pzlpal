var model = require('./model');
var Puzzle = model.Puzzle;
var cp = require('child_process');
var fs = require('fs');
var http = require('http');
var sizeOf = require('image-size');
var async = require('async');
var request = require('request');

module.exports.digitize = function(id, crop_width, crop_height, grid_coords, across_coords, down_coords) {
  Puzzle.findOne({ '_id' : id}, function(err, puzzle) {
    if (err) return clean_up(puzzle, err);

    // Set up workspace
    var dir = require('./config').app_dir + '/public/images/' + id + '/';

    // Scale grid
    scale(id, crop_width, crop_height, grid_coords, function(scaled_coords) {

      // Find slots
      get_slots(dir + 'original.png', puzzle.gridWidth, puzzle.gridHeight, scaled_coords, function(err, slots, across_slot_nums, down_slot_nums) {
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
}



/* Scales coords according to how image was scaled */
function scale(id, crop_width, crop_height, coords, cb) {
  var dir = require('./config').app_dir + '/public/images/' + id + '/';
  sizeOf(dir + 'original.png', function(err, dimensions) {
    var real_width = dimensions.width;
    var real_height = dimensions.height;
    cb({
      x : coords.x * real_width / crop_width,
      y : coords.y * real_height / crop_height,
      x2 : coords.x2 * real_width / crop_width,
      y2 : coords.y2 * real_height / crop_height,
      w : coords.w * real_width / crop_width,
      h : coords.h * real_height / crop_height,
    });
  });
}

/* Given an image, uses find_grid.py to find the puzzle grid in the image, then determines all of the slots by
 * assuming standard crossword numbering. */
function get_slots(file, width, height, grid_coords, cb) {
  cp.exec(
    "python server/find_grid.py " + file + " " + width + " " + height + " " + grid_coords.x + " " + grid_coords.y + " " + grid_coords.w + " " + grid_coords.h,
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

  var dir = require('./config').app_dir + '/public/images/' + id + '/';
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
          cb(null, JSON.parse(body).data.text);
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
  var digits = num.toString().split('');
  var chars = str.replace(/\s+/g, '').split('');
  if (chars.length < digits.length) return false;
  for (var i = 0; i < digits.length; i++) {
    var c = chars[i];
    if (c==digits[i]) continue;
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
  //remove_folder(require('./config').app_dir + '/public/images/' + puzzle._id + '/', function(err) { console.log(err)});
  return;
}

// var text = "1 Owner's directions\n 1; 3:33:\n i: at, if\"\n a e\n 20 Greetings\n 21 Nice season\n 22 Protess\n 23 CARGIL?\n 25 Simile words\n 28 Bougeinvillea.1or\n one\n 27 On the up and up\n 28 ADLAS?\n 31 Beverage\n measure\n adam's address\n `rewory\n 37 Sacred structures\n a gteelr's cousin\n reel 359\"\n 46\n 47 Actor lynn\n 49 Rooter\n g; Streetweapon\n 53 6836?\n 58 Wrath\n 59 Roasting chamber\n 61 Holbein\n 62 Solder\n 63 Nixon's nemesis\n 65 Redeoorate\n 66 interrogate\n 67 Tows\n 69 Painter's needs.\n for short\n 70 Handbag\n 72 Aesop ending\n 73 Hawkins Day\n 74 (flier Palmer\n 75 Intistinct\n 73 the\n on\n 77 USNnggss\n 80 Remainder\n 31 Sucootash\n ingredient\n 82 Suppress a news\n story\n 33 Flat boat\n 84 Author Deighton\n 3 EtgPA?\n ret\n 91 Payable\n 93 Forest denizen\n 94 Aplomb\n as Way overweight\n 97 Gobi. lor one\n 99 Worried\n 101 Finally!\n 8: E's`é`éfim\n \n103 Iowa University\n 109 WES?\n 113 AKA\n 115 Jet\n 113 Corp. money\n monitor\n 117 KEATS?\n 1 Educational inst.\n Barbie's\n 125 Sprinkler a denda\n 3: 9- W8\n ay\n 12!! Mynvt'e. counterpart\n 129 kiddi I\n 130 Weucu' loulgy\n 1 Ma queen?\n 2 Bibrical ion\n 3 Bed Bobbsey's\n twin\n 4 Polluted\n 5 Pulitzer winner\n James: 1958\n 3 Part 01 HRH\n 9 Building addition\n 10 Got 011 ct\n 11 Elaborate art style\n 12 Beauty's beloved\n 13 Confused\n 14 Recldessly\n 15 Treats miserably\n 18 Maldous\n 17 Actress Olin\n 18 Mr. Rogers\n 24 Wander idly\n 29 Sineon\n so fiEie ollspring\n 31 Pollux' twin\n 32 Niche\n 33 UNSPER?\n 35 Standards\n 38 _ gestae:\n transactions\n 4o 'Frisoo hill\n 41 Wise. neighbor\n 43 MECAR?\n 44 Buenos\n 45 Actor Montana\n 47 Tape recorder\n button\n 3 uligwygganding\n e a Davy\n 50 Grow older\n 54 Run after\n 55 D sharp\n 56 Boring\n 57 Macho man\n 30 Grammar units\n 64 Operatic\n WW:\n 67 Pen or est\n folower\n 83 Vase\n 69 Set aside\n 71 Actress Moreno\n 72 Fool's mama\n 73 Figure out\n 7; ...or _ not?\n songs\n 76 Who _. Jamaica\n 73 Airy dessert\n 79 Candies\n 80 Churl\n 31 PFC's superior\n 82 Makes booties\n 38 Fad of the 708\n 87 Pkg. carrier\n 33 Caviar\n 39 Go bad\n 92 Gull\n 96 Used TNT\n 93 Access Charlotte\n 99 Put to good\n 100 _ keen!\n 101 Surrounded by\n 103 Bid\n 104 Once _ time\n 106 Slip\n 107 Brewslrie\n 109 Newman or Simon\n 1 10 Arm bone\n 111 Weather word\n 112 Beat it!\n 1 14 Italian wine region\n 113 Columbus inst\n 1 19 _ diem\n 120 Actor Walloon\n 121 The winner's take\n 122 Mary _ Place\n"
// var across = [1,7,12,15,19,20,21,22,23,25,26,27,28,31,34,36,37,39,42,46,47,49,51,52,53,58,59,61,62,63,65,66,67,69,70,73,73,74,75,76,77,80,81,82,83,84,85,90,91,93,94,95,97,99,101,102,105,108,109,113,115,116,117,123,124,125,126,127,128,129,130]
// var down = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,24,29,30,31,32,33,35,38,40,41,43,44,45,47,48,49,50,54,55,56,57,60,64,67,68,69,71,72,73,74,75,76,78,79,80,81,82,86,87,88,89,92,96,98,99,100,101,103,104,106,107,109,110,111,112,114,118,119,120,121,122]
// get_clues(text, across, down, function(err, a,d) {console.log(a);console.log(d);});