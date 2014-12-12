var jwt = require('jwt-simple');
var jwtconfig = require('../jwt-config');

module.exports = function (req, res, next) {
    if (req.headers['x-auth']) {
            req.auth = jwt.decode(req.headers['x-auth'], jwtconfig.secret);
    }
    next();
}
