// public/core.js
var pzlPal = angular.module('pzlPal', []);

pzlPal.config(function($routeProvider) {
    $routeProvider
        .when('/', {
            templateUrl : 'pages/create.html',
            controller : 'createController'
        })
        .when('/about', {
            templateUrl : 'pages/about.html',
            controller : 'createController'
        })
        .when('/:puzzle_id/crop', {
            templateUrl : 'pages/crop.html',
            controller : 'cropController'
        })
        .when('/:puzzle_id/view', {
            templateUrl : 'pages/puzzle.html',
            controller : 'puzzleController'
        })
});

function createController($scope, $http) {
    $scope.formData = { pzlName: "Example Puzzle", imageURL: "http://s28.postimg.org/rulmey7wc/file_page1.jpg"};

    // when submitting the add form, send the text to the node API
    $scope.createPuzzle = function() {
        if ($scope.formData.pzlName.length <= 0 || $scope.formData.pzlName.length > 100) {
            $('#errors').text("Invalid puzzle name.");
            return;
        }
        if ($scope.formData.imageURL.length <= 0 || $scope.formData.imageURL.length > 200) {
            $('#errors').text("Invalid puzzle image.");
            return;
        }

        $http.post('/api/puzzles', $scope.formData)
            .success(function(puzzle) {
                window.location.hash = "#/" + puzzle._id + "/crop"
            })
            .error(function(data) {
                $('#errors').text("There were some errors in your submission. Please review and submit again.");
            });
    };

    // uploading file to imgur - https://github.com/paulrouget/miniuploader
    $scope.upload = function(file) {
        $('#upload-text').text("Uploading...");
        $('#submitBtn').prop("disabled", true);
        $('#uploadBtn').prop("disabled", true);
        $('#errors').text("");
         /* Is the file an image? */
        if (!file || !file.type.match(/image.*/)) return;
        document.body.className = "uploading";

        /* Lets build a FormData object*/
        var fd = new FormData(); 
        fd.append("image", file); 
        var xhr = new XMLHttpRequest();
        xhr.open("POST", "https://api.imgur.com/3/image.json");
        xhr.onload = function() {
            var url = JSON.parse(xhr.responseText).data.link;
            $scope.formData.imageURL = url;
            $('#imageURL').val(url);
            $('#upload-text').html("Upload Complete! <a href = '" + url + "' target='_blank'>See Image</a>");
            $('#submitBtn').prop("disabled", false);
            $('#uploadBtn').prop("disabled", false);
        }
        xhr.onerror = function() {
            $('#upload-text').html("Upload Failed. Please try uploading to <a href = 'http://imgur.com' target='_blank'>Imgur.com</a> and pasting the link.</a>" );
            $('#submitBtn').prop("disabled", false);
            $('#uploadBtn').prop("disabled", false);
        }
        
        xhr.setRequestHeader('Authorization', 'Client-ID 1f3bd725719b78b'); // Get your own key http://api.imgur.com/
        
        xhr.send(fd);
    }

}

function puzzleController($scope, $http, $routeParams, $timeout) {
    $scope.puzzle = null;
    $scope.board = [];

    $scope.loadPuzzle = function() {
        $http.get('api/puzzles/' + $routeParams.puzzle_id)
        .success(function(puzzle) {
            console.log(puzzle);
            $scope.puzzle = puzzle;
            var slots = puzzle.slots;
            slots.forEach(function(slot) {
                slot.answer = new Array(slot.len + 1).join(' ');
            });
            $('#puzzle-wrapper').crossword(slots);
        })
        .error(function(data) {
            console.log(data);
        });
    }

    $scope.retrieveAnswers = function() {
        $http.get('/api/puzzles/answers/' + $routeParams.puzzle_id)
        .success(function() {
            $scope.beginLoading();
            $scope.pollPuzzle(0);
        })
        .error(function(data) {
            console.log(data);
        });
    }

    $scope.pollPuzzle = function(count) {
        var id = $routeParams.puzzle_id;
        if (count > 20) {
            $scope.loadingFailure("We were unable to handle your request quickly enough. Please try again in a moment.");
            return;
        }
        $http.get('/api/puzzles/'+id)
            .success(function(puzzle) {
                if (puzzle.answers_status == "retrieving") {
                    setTimeout(function() { $scope.pollPuzzle(++count) }, 1000);
                } else if (puzzle.answers_status == "failure") {
                    $scope.loadingFailure("We were unable to find possible answers.")
                } else if (puzzle.answers_status == "success") {
                    $scope.loadingSuccess(puzzle);
                }
            })
            .error(function(data) {
                $scope.loadingFailure("Puzzle not found.");
            });
    };

    $scope.beginLoading = function() {
        $('#submitBtn').attr("disabled", "disabled");
        $('#submitBtn').text("Searching for possible answers...");
        $('#loadingDiv').css("display", "block");
        $('#errors').text("");
    };

    $scope.loadingSuccess = function(puzzle) {
       $scope.puzzle = puzzle;
       $('#solveForm').css("display", "none");
       $scope.solve2();
    };

    $scope.loadingFailure = function(error) {
        $('#submitBtn').removeAttr("disabled");
        $('#submitBtn').text("Solve Puzzle");
        $('#loadingDiv').css("display", "none");
        $('#errors').text(error);
    }

    $scope.solve2 = function() {
        var slots = $scope.puzzle.slots;
        slots.forEach(function(slot) {
            slot.answer = new Array(slot.len + 1).join(' ');
            slot.locked = false;
        });
        // 0 index
        for (var i = 0; i < slots.length; i++) {
            slots[i].startx--;
            slots[i].starty--;
        }

        // TODO: reverse indexing
        var board = new Array($scope.puzzle.gridHeight);
        for(var i = 0; i < $scope.puzzle.gridHeight; i++) {
            board[i] = new Array($scope.puzzle.gridWidth);
            for (var j = 0; j < $scope.puzzle.gridWidth; j++) {
                board[i][j] = ' ';
            }
        }

        var maxSlotsCount = 0;
        var maxSlots = clone(slots);
        var maxBoard = clone(board);

        var startTime = new Date().getTime();

        function updateBest(board) {
            var fullSlotsCount = 0;
            for (var i = 0; i < slots.length; i++)
                if (slots[i].answer.replace(/\s+/g, '') !== '' && slots[i].answer !== '*')
                    fullSlotsCount++;

            if (fullSlotsCount > maxSlotsCount) {
                startTime = new Date().getTime();
                maxSlotsCount = fullSlotsCount;
                maxSlots = clone(slots);
                maxBoard = clone(board);
                updateUI(board);
            }
        }

        function lockSlots(cb) {
            var pending = 0;
            for (var i = 0; i < maxSlots.length; i++) {
                if (maxSlots[i].answer.replace(/\s+/g, '')) {
                    maxSlots[i].locked = true;
                }
                if (!maxSlots[i].locked) pending++;
            }

            slots = maxSlots;
            startTime = new Date().getTime();
            console.log("Pending: " + pending);
            if (pending > 0) solve(maxBoard, cb, 1);
            else cb(true);
        }

        function updateUI(board) {
            for(var i = 0; i < $scope.puzzle.gridHeight; i++) {
                for (var j = 0; j < $scope.puzzle.gridWidth; j++) {
                    $('td[data-coords="'+(i+1)+','+(j+1)+'"] input').val(board[j][i]);
                }
            }
        }

        function clone (obj) {
            return JSON.parse(JSON.stringify(obj));
        }

        function getSlotIndex (board) {
            var maxCollisions = -100000000;
            var mcSlotIndex = -1;

            for (var i = 0; i < slots.length; i++) {
                var slot = slots[i];
                if (slot.answer.replace(/\s+/g, '').length !== 0) {
                    continue;
                }
                if(slot.locked) {
                    continue;
                }

                var collisions = 0;
                var numHighConf = 0;
                for (var j = 0; j < slot.len; j++) {
                    var curX = slot.startx;
                    var curY = slot.starty;
                    if (slot.orientation == "across")
                        curX += j;
                    else
                        curY += j;

                    var curC = board[curY][curX];
                    if (curC !== ' ') collisions++;
                }
                // Check number of 5 star answer choices and pick clue with lowest one
                for (var j = 0; j < slot.guesses.length; j++) {
                    if (slot.guesses[j].conf >= 1000) {
                        numHighConf++;
                    }
                }
                collisions *= 100;
                if (numHighConf) {
                    collisions += 20 - numHighConf;
                }


                if (collisions > maxCollisions) {
                    maxCollisions = collisions;
                    mcSlotIndex = i;
                }
            }
            
            var temp = slots[mcSlotIndex];
            return mcSlotIndex;
        }

        function canInsert(board, slotIndex, possibleAnswerIdx) {
            var slot = slots[slotIndex];
            var possibleAnswer = slot.guesses[possibleAnswerIdx];
            if (!possibleAnswer.name) return false;
            //console.log(possibleAnswer)
            //console.log(slot);
            for (var i = 0; i < possibleAnswer.name.length; i++) {
                var curX = slot.startx;
                var curY = slot.starty;
                if (slot.orientation == "across")
                    curX += i;
                else
                    curY += i;

                var curC = board[curY][curX];
                // if curC is a real char and is different from what we want to insert
                if (curC !== ' ' && curC != possibleAnswer.name[i]) {
                    //console.log("curC is " + curC + " so returning false\n");
                    return false;
                }
            }
            //console.log("FITS\n");
            return true;
        }

        function insert (board, slotIndex, possibleAnswerIdx) {
            var slot = slots[slotIndex];
            var possibleAnswer = slot.guesses[possibleAnswerIdx];
        
            var newBoard = clone(board); // deep copy
            for (var i = 0; i < possibleAnswer.name.length; i++) {
                var curX = slot.startx;
                var curY = slot.starty;
                if (slot.orientation == "across")
                    curX += i;
                else
                    curY += i;
                newBoard[curY][curX] = possibleAnswer.name[i];
            }
            slots[slotIndex].answer = possibleAnswer.name;
            return newBoard;
        }

        // modifies slots
        function fillInAnswer (board, slotIndex, possibleAnswerIdx) {
            if (canInsert(board, slotIndex, possibleAnswerIdx)) {
                var newBoard = insert(board, slotIndex, possibleAnswerIdx);
                return newBoard;
            }
            return null;
        }

        function eraseAnswer (slotIndex) {
            var newStr = "";
            for (var i = 0; i < slots[slotIndex].len; i++) 
                newStr += " ";
            slots[slotIndex].answer = newStr;
        }

        function solve(board, cb, depth) {
            updateBest(board);
            if (new Date().getTime() - startTime > 1000) {
                lockSlots(cb);
                return;
            }

            function solve_helper(i, slotIndex, cb) {
                var possibleAnswers = slots[slotIndex].guesses;


                if (i >= possibleAnswers.length) {
                    cb(false);
                    return;
                }
                var newBoard = fillInAnswer(board, slotIndex, i);
                if (newBoard) {
                    $timeout(function() {
                        solve(newBoard, function(solved) {
                            if (solved) {
                                cb(true);
                                return;
                            }
                            eraseAnswer(slotIndex);
                            $timeout(function() { solve_helper(i+1, slotIndex, cb)}, 1);
                        }, depth+1);
                    }, 1);
                } else {
                    $timeout(function() { solve_helper(i+1, slotIndex, cb)}, 1);
                }
            }

            var slotIndex = getSlotIndex(board);
            if (slotIndex === -1) {
              cb(false);
            } else {
                $timeout(function() { solve_helper(0, slotIndex, function(solved) {
                    if (solved) {
                        cb(true);
                    } else {
                        if (depth==1) {
                            slots[slotIndex].answer = "*";
                            lockSlots(cb);
                        } else {
                            cb(false);
                        }
                    }
                })}, 1);
            }
        }    

        solve(board, function(x) {
            console.log("Done.");
            console.log(slots);

        }, 1);
    }

    $scope.solve = function() {
        // initialize board
        var board = new Array($scope.puzzle.gridHeight);
        for(var i = 0; i < $scope.puzzle.gridHeight; i++) {
            board[i] = new Array($scope.puzzle.gridWidth);
            for (var j = 0; j < $scope.puzzle.gridWidth; j++) {
                board[i][j] = '';
            }
        }

        var k_max = 100000;
        var k_cur = 0, e_cur = 0;

        function temperature(x) {
            return 1-x;
        }

        function transition_probability(e_cur, e_new, temp) {
            if (e_new >= e_cur) return 1;
            var prob = (0.2 - (e_cur - e_new)/1000) * temp;
            console.log(prob);
            return prob;
        }

        function updateUI() {
            console.log(k_cur + ": " + e_cur);
            for(var i = 0; i < $scope.puzzle.gridHeight; i++) {
                for (var j = 0; j < $scope.puzzle.gridWidth; j++) {
                    $('td[data-coords="'+(i+1)+','+(j+1)+'"] input').val(board[i][j]);
                }
            }
        }

        function slotIntersect(slot1, slot2) {
            if (slot1.orientation == slot2.orientation) return null;
            if (slot1.orientation != 'across') slotIntersect(slot2, slot1);

            if (slot2.startx >= slot1.startx && slot2.startx < slot1.startx + slot1.len) {
                if (slot1.starty >= slot2.starty && slot1.starty < slot2.starty + slot2.len) {
                    return {
                        slot1_idx: slot2.startx - slot1.startx,
                        slot2_idx: slot1.starty - slot2.starty
                    }
                }
            }
            return null;
        }

        function anneal() {
            if (k_cur % 1 == 0) updateUI();
            // Pick a random slot
            var slot_idx = Math.floor(Math.random()*$scope.puzzle.slots.length);
            var slot = $scope.puzzle.slots[slot_idx];

            // Pick a random guess
            var guess_idx = Math.floor(Math.random()*$scope.puzzle.slots[slot_idx].guesses.length);
            var guess = slot.guesses[guess_idx];
            if (guess) {
                // Compute new energy
                var e_new = e_cur;
                e_new += guess.conf;
                if (slot.cur_guess) e_new -= slot.cur_guess.conf;
                $scope.puzzle.slots.forEach(function (slot2) {
                    if (!slot2.cur_guess) return;
                    var intersect = slotIntersect(slot, slot2);
                    if (intersect) {
                        if (guess.name[intersect.slot1_idx] != slot2.cur_guess.name[intersect.slot2_idx]) {
                            e_new -= slot2.cur_guess.conf;
                        }
                    }
                });

                // Consider transition
                if (transition_probability(e_cur, e_new, temperature(k_cur/k_max)) > Math.random()) {
                    // Update energy
                    e_cur = e_new;

                    // Update board
                    for (var i = 0; i < slot.len; i++) {
                        if (slot.orientation == 'across') {
                            board[slot.startx + i - 1][slot.starty - 1] = guess.name[i];
                        } else {
                            board[slot.startx - 1][slot.starty + i - 1] = guess.name[i];
                        }
                    }

                    // Update slots
                    slot.cur_guess = guess;
                    $scope.puzzle.slots.forEach(function (slot2) {
                        if (!slot2.cur_guess) return;
                        var intersect = slotIntersect(slot, slot2);
                        if (intersect) {
                            if (guess.name[intersect.slot1_idx] != slot2.cur_guess.name[intersect.slot2_idx]) {
                                slot2.cur_guess = null;
                            }
                        }
                    });
                }
            }
            k_cur++;
            if (k_cur < k_max) $timeout(anneal, 5000);
        }
        anneal();
    }
}

function cropController($scope, $http, $routeParams) {
    $scope.formData = {};

    $http.get('api/puzzles/' + $routeParams.puzzle_id)
        .success(function(puzzle) {
            $scope.puzzle = puzzle;
        })
        .error(function(data) {
            console.log(data);
        });

    $scope.loadCropper = function() {
        $('#jcrop_target').Jcrop({
            onChange: $scope.showPreview,
            onSelect: $scope.showPreview
        });
        $scope.formData.preview_coords = {w : 0, h : 0, x : 0, y : 0, x2 : 0, y2 : 0 };
        $scope.formData.across_coords = [];
        $scope.formData.down_coords = [];

    }

    $scope.scaleImage = function(coords, container_id) {
        if (coords.w > coords.h) {
            scaled_width = Math.min(200, coords.w);
            scaled_height = coords.h * (scaled_width / coords.w);
        } else {
            scaled_height = Math.min(200, coords.h);
            scaled_width = coords.w * (scaled_height / coords.h);
        }
        $('#' + container_id).css({
            width: Math.round(scaled_width) + 'px',
            height: Math.round(scaled_height) + 'px'
        });

        var rx = scaled_width / coords.w;
        var ry = scaled_height / coords.h;

        $('#' + container_id + ' :last-child').css({
            width: Math.round(rx * $('#jcrop_target').width()) + 'px',
            height: Math.round(ry * $('#jcrop_target').height()) + 'px',
            marginLeft: '-' + Math.round(rx * coords.x) + 'px',
            marginTop: '-' + Math.round(ry * coords.y) + 'px'
        });
    }

    $scope.showPreview = function(coords) {
        $('#preview').css("visibility", "visible");
        $scope.scaleImage(coords, "preview");
        $scope.formData.preview_coords = coords;
    }

    $scope.addAcross = function() {
        if ($scope.formData.preview_coords.w > 5 && $scope.formData.preview_coords.h > 5) {
            $scope.formData.across_coords.push($scope.formData.preview_coords);
            $('#across-container').append("<div style='overflow:hidden;float:left;margin:5px' id = 'across-" + $scope.formData.across_coords.length + "'><img src='" + $scope.puzzle.imageURL + "'></div>");
            $scope.scaleImage($scope.formData.preview_coords, "across-" + $scope.formData.across_coords.length);
        }
    }

    $scope.clearAcross = function() {
        $scope.formData.across_coords = [];
        $('#across-container').html("");
    }

    $scope.addDown = function() {
        if ($scope.formData.preview_coords.w > 5 && $scope.formData.preview_coords.h > 5) {
            $scope.formData.down_coords.push($scope.formData.preview_coords);
            $('#down-container').append("<div style='overflow:hidden;float:left;margin:5px' id = 'down-" + $scope.formData.down_coords.length + "'><img src='" + $scope.puzzle.imageURL + "'></div>");
            $scope.scaleImage($scope.formData.preview_coords, "down-" + $scope.formData.down_coords.length);
        }
    }

    $scope.clearDown = function() {
        $scope.formData.down_coords = [];
        $('#down-container').html("");
    }

    $scope.validateAndSubmit = function() {
        // validate image
        $scope.formData.image_width = $('#jcrop_target').width();
        $scope.formData.image_height = $('#jcrop_target').height();

        if (!$scope.formData.image_width || $scope.formData.image_width == 0
                || $scope.formData.image_height == 0
                || $scope.formData.image_width > 5000
                || $scope.formData.image_height > 5000) {
            $('#errors').text("The image file has invalid dimensions.");
            return;
        }

        // validate grid width
        if (!$scope.formData.gridWidth || $scope.formData.gridWidth <= 0
                || $scope.formData.gridWidth > 100) {
            $('#errors').text("The grid width must be between 1 and 100.");
            return;
        }

        // validate grid height
        if (!$scope.formData.gridHeight || $scope.formData.gridHeight <= 0
                || $scope.formData.gridHeight > 100) {
            $('#errors').text("The grid height must be between 1 and 100.");
            return;
        }

        // validate coords
        if ($scope.formData.across_coords.length == 0) {
            $('#errors').text("Please add the across clues.");
            return;
        }
        if ($scope.formData.down_coords.length == 0) {
            $('#errors').text("Please add the down clues.");
            return;
        }
        if ($scope.formData.across_coords.length > 10 || $scope.formData.down_coords.length > 10) {
            $('#errors').text("Too many pictures added.");
            return;
        }

        $http.post('/api/puzzles/' + $scope.puzzle._id, $scope.formData)
            .success(function(puzzle) {
                $scope.beginLoading();
                $scope.pollPuzzle(puzzle._id, 0);
                console.log(puzzle);
            })
            .error(function(data) {
                $('#errors').text("There were some errors in your submission. Please review and submit again.");
            });
    }

    $scope.pollPuzzle = function(id, count) {
        if (count > 20) {
            $scope.loadingFailure("We were unable to handle your request quickly enough. Please try again in a moment.");
            return;
        }
        $http.get('/api/puzzles/'+id)
            .success(function(puzzle) {
                if (puzzle.digitizing_status == "digitizing") {
                    setTimeout(function() { $scope.pollPuzzle(id, ++count) }, 3000);
                } else if (puzzle.digitizing_status == "failure") {
                    $scope.loadingFailure("We were unable to digitize your puzzle. Please ensure that the image URL you've entered is valid.")
                } else if (puzzle.digitizing_status == "success") {
                    $scope.loadingSuccess(id);
                }
            })
            .error(function(data) {
                $scope.loadingFailure("Puzzle not found.");
            });
    };

    $scope.beginLoading = function() {
        $('#submitBtn').attr("disabled", "disabled");
        $('#submitBtn').text("Digitizing Puzzle...");
        $('#loadingDiv').css("display", "block");
        $('#errors').text("");
    };

    $scope.loadingSuccess = function(id) {
        window.location.hash = "#/" + id + "/view"
    };

    $scope.loadingFailure = function(error) {
        $('#submitBtn').removeAttr("disabled");
        $('#submitBtn').text("Digitize Puzzle");
        $('#loadingDiv').css("display", "none");
        $('#errors').text(error);
    }


}