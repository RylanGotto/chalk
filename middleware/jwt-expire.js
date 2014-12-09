/**
 * Created by rylan on 08/12/14.
 */
module.exports = function (req, res, next) {
    if (req.auth){
        var date = new Date();
        var currentTime = date.getTime();
        if (req.auth.exp < currentTime) {
            return res.status(401).json({message : 'Session Expired'});
        }
    }
    next();
}