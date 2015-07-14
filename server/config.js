module.exports.node_port = process.env.PORT || 5000;
module.exports.mongo_url = process.env.MONGO_URL || "mongodb://localhost"
module.exports.solr_domain = process.env.SOLR_DOMAIN || "127.0.0.1"
module.exports.solr_port = process.env.SOLR_PORT || 8080
module.exports.solr_path = process.env.SOLR_PATH || "/solr"
module.exports.newocr_key = process.env.NEWOCR_KEY || ""