var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var UserSchema   = new Schema({
    username: String,
    profileImage: String,
    friends: [ {type: String, ref: 'User'} ],
    boards: [ {type: String, ref: 'Board'} ]
});

module.exports = mongoose.model('User', UserSchema);