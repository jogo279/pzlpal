var fs = require('fs');
var async = require('async');

fs.readdir(require('./../config').app_dir + '/public/images', function(err, files) {
  if (err) {
    console.log(err);
    return;
  }
  files.forEach(function(file) {
    fs.stat(require('./../config').app_dir + '/public/images/' + file, function(err, stats) {
      if (err) {
        console.log(err);
        return;
      }
      var now = new Date();
      if (stats.isDirectory() && now - stats.mtime > 24 * 60 * 60 * 1000 ) {
        remove_folder(require('./../config').app_dir + '/public/images/' + file);
      }
    })
  })
})

/* http://stackoverflow.com/questions/18052762/remove-directory-which-is-not-empty */
function remove_folder(location) {
    fs.readdir(location, function (err, files) {
        async.each(files, function (file, cb) {
            file = location + '/' + file
            fs.stat(file, function (err, stat) {
                if (err) {
                    return cb(err);
                }
                if (stat.isDirectory()) {
                    removeFolder(file, cb);
                } else {
                    fs.unlink(file, function (err) {
                        if (err) {
                            return cb(err);
                        }
                        return cb();
                    })
                }
            })
        }, function (err) {
            if (err) { 
              console.log(err);
              return;
            }
            fs.rmdir(location, function (err) {
                if (err) console.log(err);
            })
        })
    })
}