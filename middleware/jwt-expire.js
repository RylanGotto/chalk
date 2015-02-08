/**
 * Created by rylan on 08/12/14.
 */
var jmsg = require('../status-responses');
/**
 *
 * @param req
 * @param res
 * @param next
 *
 * If JSON Web Token is valid, check the expire time decoded from JWT and test to make sure the token is still valid.
 * If not set req.auth attribute to undefined.
 */
module.exports = function (req, res, next) {
    if (req.auth) {
        var date = new Date();
        var currentTime = date.getTime();
        if (req.auth.exp < currentTime) {
            req.auth = undefined;
        }
    }
    next();
}
