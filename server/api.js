var Puzzle = require('./model').Puzzle;
var fs = require('fs');
var cp = require('child_process');
var request = require('request');

module.exports.create_puzzle = function(req, res) {

    function createEmptyPuzzle(cb) {
        Puzzle.create({
            digitizing_status : 'waiting',
            answers_status : 'waiting',
            slots : [],
            answer : ""
        }, function(err, puzzle) {
            cb(puzzle);
        });
    }

    function imageType(contentType) {
        if (contentType == 'image/png') return 'png';
        if (contentType == 'image/gif') return 'gif';
        if (contentType == 'image/bmp') return 'bmp';
        if (contentType == 'image/jpeg') return 'jpg';
        return null;
    }

    var file = req.files.file;
    if (file) {
        if (!imageType(file.headers['content-type'])) {
            res.status(400).json({error: "Unsupported File Type"});
            fs.unlink(file.path);
        } else {
            createEmptyPuzzle(function(puzzle) {
                var id = puzzle._id;
                fs.mkdir('public/images/' + id, function(err) {
                    cp.exec(
                        "convert " + file.path + " " + 'public/images/' + id + "/original.png",
                        function(err, stdout, stderr) {
                            if (err) {
                                res.status(400).json({error: err.message});
                            } else {
                                res.json(puzzle);
                                fs.unlink(file.path);
                            }
                        }
                    );
                });
            });

        }
    } else {
        var uri = JSON.parse(req.body.data).imageURL;
        if (!uri) {
            res.status(400).json({error: "Empty Form"});
            return;
        }
        var ext = uri.split(".").pop();
        request.head(uri, function(err, res2, body){
            if (res2.headers['content-length'] > 10000000) {
                res.status(400).json({error: "File over 10MB"});
            } else if (!imageType(res2.headers['content-type'])) {
                res.status(400).json({error: "Not an image"});
            } else {
                createEmptyPuzzle(function(puzzle) {
                    var id = puzzle._id;
                    fs.mkdir('public/images/' + id, function(err) {
                        request(uri).pipe(fs.createWriteStream('public/images/' + id + '/original.' + ext)).on('close', function() {
                            cp.exec(
                                "convert " + 'public/images/' + id + "/original." + imageType(res2.headers['content-type']) + " " + 'public/images/' + id + "/original.png",
                                function(err, stdout, stderr) {
                                    if (err) {
                                        res.status(400).json({error: err.message});
                                    } else {
                                        res.json(puzzle);
                                    }
                                }
                            );
                        });
                    });
                });
            }
        });
    }
}

// get puzzle
module.exports.retrieve_puzzle = function(req, res) {
    Puzzle.findOne({'_id' : req.params.id}, function(err, puzzle) {
        if (err) {
            res.status(400).json({error: err.message});
        } else {
            res.json(puzzle);
        }
    });
}

// update puzzle with information from the crop screen
module.exports.update_puzzle = function(req, res) {
    Puzzle.findOne({'_id' : req.params.id}, function(err, puzzle) {
        if (err) {
            res.status(400).json({error: err.message});
        } else {
            puzzle.gridWidth = req.body.gridWidth;
            puzzle.gridHeight = req.body.gridHeight;
            puzzle.digitizing_status = "digitizing"
            puzzle.save(function (err) {
                if (err) {
                    res.status(400).json({error: err.message});
                } else {
                    res.json(puzzle);
                    require('./digitize').digitize(
                        puzzle._id, 
                        req.body.image_width,
                        req.body.image_height,
                        req.body.grid_coords,
                        req.body.across_coords,
                        req.body.down_coords
                    );
                }
            });
        }
    });
}

module.exports.get_possible_answers = function(req, res) {
    Puzzle.findOne({'_id' : req.params.id}, function(err, puzzle) {
        if (err) {
            res.status(400).json({error: err.message});
        } else {
            puzzle.answers_status = 'retrieving';
            puzzle.save(function (err) {
                if (err) {
                    res.status(400).json({error: err.message});
                } else {
                    require('./possible_answers').retrieve(puzzle._id);
                    res.json({});
                }
            });
        }
    });
}