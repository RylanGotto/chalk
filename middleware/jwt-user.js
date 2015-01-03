var DataModel = require('../models/datamodel');
var jmsg = require('../status-responses');
module.exports = function (req, res, next) {
    if (req.auth) {
        DataModel.User.findOne({username: {$in: [req.auth.username]}})
            .select('id').select('username')
            .exec(function (err, user) {
                if (err) {
                    return next(err);
                }
                if (!user) {
                    user = null;
                }
                if (user.id != req.auth.id) {
                    req.auth = null;
                }
            });
    }
    next();
}
