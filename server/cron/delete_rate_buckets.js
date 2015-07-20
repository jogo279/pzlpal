var RateBucket = require('./model').RateBucket;
RateBucket.remove({}, function(err) {
  if (err) {
    console.log(err);
  } else {
    console.log("Success");
  }
})