/**
 * Created by rylan on 08/12/14.
 */
var jmsg = require('../status-responses');
module.exports = function (req, res, next) {
    if (req.auth) {
        var date = new Date();
        var currentTime = date.getTime();
        if (req.auth.exp < currentTime) {
            return res.status(401).json(jmsg.sess_exp);
        }
    }
    next();
}
