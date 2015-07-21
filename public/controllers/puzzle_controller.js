angular.module('pzlPal').controller('puzzleController',  function($scope, $http, $routeParams, $timeout) {
    $scope.puzzle = null;
    $scope.puzzle_id = $routeParams.puzzle_id;
    $scope.board = [];

    $scope.loadPuzzle = function() {
        $http.get('api/puzzles/' + $routeParams.puzzle_id)
        .success(function(puzzle) {
            $scope.puzzle = puzzle;
            var slots = puzzle.slots;
            slots.forEach(function(slot) {
                slot.answer = new Array(slot.len + 1).join(' ');
            });
            $('#puzzle-wrapper').crossword(slots);
            $('#clear').css('clear','both');
            $scope.resetClues();
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
        .error(function(data, status, headers, config) {
            if (status==429) {
                $scope.loadingFailure("To reduce burden on our servers, we limit users to 100 solves per day. We apologize for the inconvenience.");
                $('#submitBtn').attr("disabled", "disabled");
            } else {
                $scope.loadingFailure("We encountered an internal error. We apologize for the inconvenience.");
            }
        });
    }

    $scope.saveChangesAndSolve = function() {
        var clues = {};
        $('.clue').each(function (clue) {
            clues[$(this).attr('id')] = $(this).val();
        });
        $http.post('/api/puzzles/' + $routeParams.puzzle_id + '/clues', clues)
            .success(function(data) {
                $scope.retrieveAnswers();
            })
            .error(function(data, status, headers, config) {
                if (status==429) {
                    $('#errors').text("To reduce burden on our servers, we limit users to 100 solves per day. We apologize for the inconvenience.");
                    $('#submitBtn').attr("disabled", "disabled");
                } else {
                    $('#errors').text("Unable to save changes.");
                }   
            })
    }

    $scope.resetClues = function() {
        $scope.puzzle.slots.forEach(function (slot) {
            $('#clue-' + slot.orientation + '-' + slot.position).val(slot.clue);
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
            .error(function(data, status, headers, config) {
                $scope.loadingFailure("We encountered an internal error. We apologize for the inconvenience.");
            });
    };

    $scope.beginLoading = function() {
        $('#submitBtn').attr("disabled", "disabled");
        $('#resetBtn').attr("disabled", "disabled");
        $('#submitBtn').text("Searching for possible answers...");
        $('#loadingDiv').css("display", "block");
        $('#errors').text("");
    };

    $scope.loadingSuccess = function(puzzle) {
       $scope.puzzle = puzzle;
       $('#submitBtn').text("Solving Puzzle...");
       $scope.solve();
    };

    $scope.loadingFailure = function(error) {
        $('#submitBtn').removeAttr("disabled");
        $('#resetBtn').removeAttr("disabled");
        $('#submitBtn').text("Save Clues and Solve");
        $('#loadingDiv').css("display", "none");
        $('#errors').text(error);
    }

    $scope.puzzleSolved = function() {
        $('#submitBtn').removeAttr("disabled");
        $('#resetBtn').removeAttr("disabled");
        $('#submitBtn').text("Save Clues and Solve");
        $('#loadingDiv').css("display", "none");
    }

    $scope.solve = function() {
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
                    return false;
                }
            }
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
            $scope.puzzleSolved();
        }, 1);
    }
});