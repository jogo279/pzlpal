var mongoose = require('mongoose');
var coordSchema = {
    x : Number,
    y : Number,
    x2 : Number,
    y2 : Number,
    w : Number,
    h : Number
}
var guessSchema = {
    name : String,
    conf : Number
};
var slotSchema = {
    clue : { type : String, maxLength: 200 },
    answer : String,
    startx : Number,
    starty : Number,
    len : Number,
    orientation : String,
    position : Number,
    guesses : [guessSchema]
};
var puzzleSchema = {
    digitizing_status : {type : String, enum: ['waiting', 'digitizing', 'success', 'failure']},
    answers_status : {type : String, enum: ['waiting', 'retrieving', 'success', 'failure']},
    image_width : Number,
    image_height : Number,
    slots : [slotSchema],
    grid_coords : coordSchema,
    across_coords : [coordSchema],
    down_coords : [coordSchema],
    gridWidth : {type : Number, min : 1, max : 30 },
    gridHeight : {type : Number, min : 1, max : 30 },
    imageURL : {type : String, minlength: 1, maxlength: 200}
};
var Puzzle = mongoose.model('Puzzle', puzzleSchema);

var rateBucketSchema = {
    created: { type: Date, required: true, default: Date.now },
    ip: { type: String, required: true, trim: true },
    path: { type : String, required: true, trim: true },
    hits: { type: Number, default: 1, required: true },
}
var RateBucket = mongoose.model('RateBucket', rateBucketSchema);

module.exports.Puzzle = Puzzle;
module.exports.RateBucket = RateBucket;