/* Rate limiter for creating puzzles and digitizing puzzles */
var RateBucket = require('./model').RateBucket;
var duration = require('./config').rate_limit_duration;
var max_hits = require('./config').rate_limit_max_hits;

// remove all on start up
RateBucket.find({}).remove();

exports.limit = function(request, response, next) {  
    var ip = request.headers['x-forwarded-for'] ||
        request.connection.remoteAddress ||
        request.socket.remoteAddress;

    var path = request.method + "::" + request.url;

    RateBucket
        .findOneAndUpdate({ip: ip, path: path}, { $inc: { hits: 1 } }, { upsert: false })
        .exec(function(error, rateBucket) {
            if (error) {
                response.statusCode = 500;
                return next(error);
            }
            if(!rateBucket) {
                rateBucket = new RateBucket({
                    createdAt: new Date(),
                    ip: ip,
                    path: path
                });
                rateBucket.save(function(error, rateBucket) {
                    if (error) {
                        response.statusCode = 500;
                        return next(error);
                    }
                    if(!rateBucket) {
                        response.statusCode = 500;
                        return response.json({error: "RateLimit", message: 'Cant\' create rate limit bucket'});
                    }
                    request.rateBucket = rateBucket;
                    return next();
                });
            } else {
                var now = new Date();
                if (now - rateBucket.created > duration) {
                    rateBucket.hits = 1;
                    rateBucket.created = now;
                    rateBucket.save(function(error, rateBucket) {
                        return next();
                    })
                } else if (rateBucket.hits <= max_hits) {
                    return next();
                } else {
                    response.statusCode = 429;
                    return response.json({error: "RateLimit", message: 'Too Many Requests'});
                }
            }
        });

};