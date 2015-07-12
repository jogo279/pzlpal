var Puzzle = require('./model').Puzzle;

module.exports.create_puzzle = function(req, res) {

    Puzzle.create({
        name : req.body.pzlName,
        digitizing_status : 'waiting',
        answers_status : 'waiting',
        slots : [],
        answer: "",
        imageURL : req.body.imageURL
    }, function (err, puzzle) {
        if (err) {
            res.status(400).json({error: err.message});
        } else {
            res.json(puzzle);
        }
    });
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