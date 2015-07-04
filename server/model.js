var mongoose = require('mongoose');
var guessSchema = {
    name : String,
    conf : Number
};
var slotSchema = {
    clue : String,
    answer : String,
    startx : Number,
    starty : Number,
    len : Number,
    orientation : String,
    position : Number,
    guesses : [guessSchema]
};
var puzzleSchema = {
    name : {type : String, minlength: 1, maxlength: 100},
    status : {type : String, enum: ['digitizing', 'success', 'failure']},
    slots : [slotSchema],
    gridWidth : {type : Number, min : 1, max : 30 },
    gridHeight : {type : Number, min : 1, max : 30 },
    imageURL : {type : String, minlength: 1, maxlength: 200}
};
var Puzzle = mongoose.model('Puzzle', puzzleSchema);
var clueSchema = {
    clue : String,
    answer : String,
    length : Number
}


module.exports.Puzzle = Puzzle;
module.exports.Clue = Clue;