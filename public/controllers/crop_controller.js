angular.module('pzlPal').controller('cropController', function($scope, $http, $routeParams, $location) {

    $scope.formData = {
        preview_coords : {w : 0, h : 0, x : 0, y : 0, x2 : 0, y2 : 0 },
        across_coords : [],
        down_coords : [],
        grid_coords : {}
    };

    $http.get('api/puzzles/' + $routeParams.puzzle_id)
        .success(function(puzzle) {
            $scope.puzzle = puzzle;
            $scope.puzzle.imageURL = 'images/' + puzzle._id + '/original.png'
            $scope.formData.gridWidth = puzzle.gridWidth;
            $scope.formData.gridHeight = puzzle.gridHeight;
        })
        .error(function(data) {
            console.log(data);
        });

    $scope.loadCropper = function() {
        $('#jcrop_target').Jcrop({
            onChange: $scope.showPreview,
            onSelect: $scope.showPreview
        });
        console.log($scope.puzzle)
        if ($scope.puzzle.grid_coords) $scope.addGrid($scope.scaleCoords($scope.puzzle.grid_coords, true));
        $scope.puzzle.across_coords.forEach(function(coords) { $scope.addAcross($scope.scaleCoords(coords, true)) });
        $scope.puzzle.down_coords.forEach(function(coords) { $scope.addDown($scope.scaleCoords(coords, true)) });
    }

    $scope.scaleCoords = function(coords, from_original) {
        if (from_original) {
            var source_width = $scope.puzzle.image_width * 1.0;
            var source_height = $scope.puzzle.image_height * 1.0;
            var target_width = $('#jcrop_target').width();
            var target_height = $('#jcrop_target').height();
        } else {
            var target_width = $scope.puzzle.image_width * 1.0;
            var target_height = $scope.puzzle.image_height * 1.0;
            var source_width = $('#jcrop_target').width();
            var source_height = $('#jcrop_target').height();
        }

        return {
            x: coords.x * target_width / source_width,
            y: coords.y * target_height / source_height,
            x2: coords.x2 * target_width / source_width,
            y2: coords.y2 * target_height / source_height,
            w: coords.w * target_width / source_width,
            h: coords.h * target_height / source_height
        };
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

    $scope.addAcross = function(coords) {
        coords = typeof coords !== 'undefined' ? coords : $scope.formData.preview_coords;
        if (coords.w > 5 && coords.h > 5) {
            $scope.formData.across_coords.push(coords);
            $('#across-container').append("<div style='overflow:hidden;float:left;margin:5px' id = 'across-" + $scope.formData.across_coords.length + "'><img src='" + $scope.puzzle.imageURL + "'></div>");
            $scope.scaleImage(coords, "across-" + $scope.formData.across_coords.length);
        }
    }

    $scope.clearAcross = function() {
        $scope.formData.across_coords = [];
        $('#across-container').html("");
    }

    $scope.addDown = function(coords) {
        coords = typeof coords !== 'undefined' ? coords : $scope.formData.preview_coords;
        if (coords.w > 5 && coords.h > 5) {
            $scope.formData.down_coords.push(coords);
            $('#down-container').append("<div style='overflow:hidden;float:left;margin:5px' id = 'down-" + $scope.formData.down_coords.length + "'><img src='" + $scope.puzzle.imageURL + "'></div>");
            $scope.scaleImage(coords, "down-" + $scope.formData.down_coords.length);
        }
    }

    $scope.clearDown = function() {
        $scope.formData.down_coords = [];
        $('#down-container').html("");
    }

    $scope.addGrid = function(coords) {
        coords = typeof coords !== 'undefined' ? coords : $scope.formData.preview_coords;
        if (coords.w > 5 && coords.h > 5) {
            $scope.formData.grid_coords = coords;
            $('#grid-container').append("<div style='overflow:hidden;float:left;margin:5px' id = 'grid'><img src='" + $scope.puzzle.imageURL + "'></div>");
            $scope.scaleImage(coords, "grid");
        }
    }

    $scope.clearGrid = function() {
        $scope.formData.grid_coords = {};
        $('#grid-container').html("");
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
        if ($.isEmptyObject($scope.formData.grid_coords)) {
            $('#errors').text("Please set a grid.");
            return;
        }
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

        $scope.formData.scaled_grid_coords = $scope.scaleCoords($scope.formData.grid_coords, false);
        $scope.formData.scaled_across_coords = $scope.formData.across_coords.map(function (coords) { return $scope.scaleCoords(coords, false)});
        $scope.formData.scaled_down_coords = $scope.formData.down_coords.map(function (coords) { return $scope.scaleCoords(coords, false)});

        $http.post('/api/puzzles/' + $scope.puzzle._id, $scope.formData)
            .success(function(puzzle) {
                $scope.beginLoading();
                $scope.pollPuzzle(puzzle._id, 0);
            })
            .error(function(data, status, headers, config) {
                if (status==429) {
                    $('#submitBtn').attr("disabled", "disabled");
                    $('#errors').text("To reduce burden on our servers, we limit users to 10 puzzles per day. We apologize for the inconvenience.");
                } else {
                    $('#errors').text("There were some errors in your submission. Please review and submit again.");
                }
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
                $scope.loadingFailure("We encountered an internal error. We apologize for the inconvenience.");
            });
    };

    $scope.beginLoading = function() {
        $('#submitBtn').attr("disabled", "disabled");
        $('#submitBtn').text("Digitizing Puzzle...");
        $('#loadingDiv').css("display", "block");
        $('#errors').text("");
    };

    $scope.loadingSuccess = function(id) {
        $location.path("/" + id + "/view");

    };

    $scope.loadingFailure = function(error) {
        $('#submitBtn').removeAttr("disabled");
        $('#submitBtn').text("Digitize Puzzle");
        $('#loadingDiv').css("display", "none");
        $('#errors').text(error);
    }


});