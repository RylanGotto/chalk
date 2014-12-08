var jwt = require('jwt-simple');
var mysecret = 'words and things';

module.exports = function (req, res, next) {
    if (req.headers['x-auth']) {
        req.auth = jwt.decode(req.headers['x-auth'], mysecret);
    }
    next();
}