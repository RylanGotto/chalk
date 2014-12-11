var DataModel = require('../models/datamodel');
module.exports = function (req, res, next) {
    if (req.auth) {
        DataModel.User.findOne({username: {$in: [req.auth.username]}})
            .select('id').select('username')
            .exec(function (err, user) {
                if (err) {
                    return next(err);
                }
                if (!user) {
                    return res.status(401).send({message: 'Unauthorized Token'});
                }
                if (user.id != req.auth.id) {
                    return res.status(401).send({message: 'Unauthorized Token'});
                }
            });
    }
    next();
}