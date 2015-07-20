var mongoose = require('mongoose');
mongoose.connect(require('../config').mongo_url);
var RateBucket = mongoose.model('RateBucket', {})
RateBucket.remove({}, function(err) {
  mongoose.disconnect(function() {
    if (err) {
      console.log(err);
    } else {
      console.log("Success");
    }
  });
});
