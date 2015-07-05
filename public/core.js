// public/core.js
var pzlPal = angular.module('pzlPal', []);

pzlPal.config(function($routeProvider) {
    $routeProvider
        .when('/', {
            templateUrl : 'pages/create.html',
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
            $('#upload-text').html("Upload Complete! <a href = '" + url + "' target='_blank'>See Image</a>");
        }
        xhr.onerror = function() {
            $('#upload-text').html("Upload Failed. Please try uploading to <a href = 'http://imgur.com' target='_blank'>Imgur.com</a> and pasting the link.</a>" );
        }
        
        xhr.setRequestHeader('Authorization', 'Client-ID 1f3bd725719b78b'); // Get your own key http://api.imgur.com/
        
        xhr.send(fd);
    }

}

function puzzleController($scope, $http, $routeParams) {


    $scope.loadPuzzle = function() {
        $http.get('api/puzzles/' + $routeParams.puzzle_id)
        .success(function(puzzle) {
            $scope.puzzle = puzzle;
            var slots = puzzle.slots;
            slots.forEach(function(slot) {
                slot.answer = new Array(slot.len + 1).join('x');
            });
            var puzzleData = [
                {
                    clue: "First letter of greek alphabet",
                    answer: "alpha",
                    position: 1,
                    orientation: "across",
                    startx: 1,
                    starty: 1
                },
                {
                    clue: "Not a one ___ motor, but a three ___ motor",
                    answer: "phase",
                    position: 3,
                    orientation: "across",
                    startx: 7,
                    starty: 1
                },
                {
                    clue: "Created from a separation of charge",
                    answer: "capacitance",
                    position: 5,
                    orientation: "across",
                    startx: 1,
                    starty: 3
                },
                {
                    clue: "The speeds of engines without and accelaration",
                    answer: "idlespeeds",
                    position: 8,
                    orientation: "across",
                    startx: 1,
                    starty: 5
                },
                {
                    clue: "Complex resistances",
                    answer: "impedances",
                    position: 10,
                    orientation: "across",  
                    startx: 2,
                    starty: 7
                },
                {
                    clue: "This device is used to step-up, step-down, and/or isolate",
                    answer: "transformer",
                    position: 13,
                    orientation: "across",
                    startx: 1,
                    starty: 9
                },
                {
                    clue: "Type of ray emitted frm the sun",
                    answer: "gamma",
                    position: 16,
                    orientation: "across",
                    startx: 1,
                    starty: 11
                },
                {
                    clue: "C programming language operator",
                    answer: "cysan",
                    position: 17,
                    orientation: "across",
                    startx: 7,
                    starty: 11
                },
                {
                    clue: "Defines the alpha-numeric characters that are typically associated with text used in programming",
                    answer: "ascii",
                    position: 1,
                    orientation: "down",
                    startx: 1,
                    starty: 1
                },
                {
                    clue: "Generally, if you go over 1kV per cm this happens",
                    answer: "arc",
                    position: 2,
                    orientation: "down",
                    startx: 5,
                    starty: 1
                },
                {
                    clue: "Control system strategy that tries to replicate the human through process (abbr.)",
                    answer: "ann",
                    position: 4,
                    orientation: "down",
                    startx: 9,
                    starty: 1
                },
                {
                    clue: "Greek variable that usually describes rotor positon",
                    answer: "theta",
                    position: 6,
                    orientation: "down",
                    startx: 7,
                    starty: 3
                },
                {
                    clue: "Electromagnetic (abbr.)",
                    answer: "em",
                    position: 7,
                    orientation: "down",
                    startx: 11,
                    starty: 3
                },
                {
                    clue: "No. 13 across does this to a voltage",
                    answer: "steps",
                    position: 9,
                    orientation: "down",
                    startx: 5,
                    starty: 5
                },
                {
                    clue: "Emits a lout wailing sound",
                    answer: "siren",
                    position: 11,
                    orientation: "down",
                    startx: 11,
                    starty: 7
                },
                {
                    clue: "Information technology (abbr.)",
                    answer: "it",
                    position: 12,
                    orientation: "down",
                    startx: 1,
                    starty: 8
                },
                {
                    clue: "Asynchronous transfer mode (abbr.)",
                    answer: "atm",
                    position: 14,
                    orientation: "down",
                    startx: 3,
                    starty: 9
                },
                {
                    clue: "Offset current control (abbr.)",
                    answer: "occ",
                    position: 15,
                    orientation: "down",
                    startx: 7,
                    starty: 9
                }
            ];
            $('#puzzle-wrapper').crossword(slots);
        })
        .error(function(data) {
            console.log(data);
        });
        
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
        $scope.formData.preview_coords = {w : 200, h : 200, x : 0, y : 0, x2 : 200, y2 : 200 };
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
        $scope.scaleImage(coords, "preview");
        $scope.formData.preview_coords = coords;
    }

    $scope.addAcross = function() {
        $scope.formData.across_coords.push($scope.formData.preview_coords);
        $('#across-container').append("<div style='overflow:hidden;float:left;margin:5px' id = 'across-" + $scope.formData.across_coords.length + "'><img src='" + $scope.puzzle.imageURL + "'></div>");
        $scope.scaleImage($scope.formData.preview_coords, "across-" + $scope.formData.across_coords.length);
    }

    $scope.clearAcross = function() {
        $scope.formData.across_coords = [];
        $('#across-container').html("");
    }

    $scope.addDown = function() {
        $scope.formData.down_coords.push($scope.formData.preview_coords);
        $('#down-container').append("<div style='overflow:hidden;float:left;margin:5px' id = 'down-" + $scope.formData.down_coords.length + "'><img src='" + $scope.puzzle.imageURL + "'></div>");
        $scope.scaleImage($scope.formData.preview_coords, "down-" + $scope.formData.down_coords.length);
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
        if (count > 10) {
            $scope.loadingFailure("We were unable to handle your request quickly enough. Please try again in a moment.");
            return;
        }
        $http.get('/api/puzzles/'+id)
            .success(function(puzzle) {
                if (puzzle.status == "digitizing") {
                    setTimeout(function() { $scope.pollPuzzle(id, ++count) }, 2000);
                } else if (puzzle.status == "failure") {
                    $scope.loadingFailure("We were unable to digitize your puzzle. Please ensure that the image URL you've entered is valid.")
                } else if (puzzle.status == "success") {
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