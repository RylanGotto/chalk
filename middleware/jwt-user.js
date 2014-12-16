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
                    return res.status(401).send(jsmg.toke_unauth);
                }
                if (user.id != req.auth.id) {
                    return res.status(401).send(jsmg.toke_unauth);
                }
            });
    }
    next();
}
