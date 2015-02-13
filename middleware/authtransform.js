var jwt = require('jwt-simple');
var jwtconfig = require('../config/config');


/**
 *
 * @param req
 * @param res
 * @param next
 * Check if x-auth header exists in request. If header does exist try to decode JSON Web Token.
 * If Web token is valid store the decoded user information within the req.auth attribute.
 * If Web token is not valid, keep req.auth as undefined and have it fail when trying to access restricted resource.
 */
module.exports = function (req, res, next) {
    if (req.headers['x-auth']) {
            req.auth = jwt.decode(req.headers['x-auth'], jwtconfig.secret);
    }
    next();
}
