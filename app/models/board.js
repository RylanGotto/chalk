var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var BoardSchema   = new Schema({
    posts: [ {type: String, ref: 'Post'} ],
    privacyLevel: Number,
    owner: {type: String, ref: 'User'},
    maxTTL: Number,
    tag: String,
    timeout: Number
});

module.exports = mongoose.model('Board', BoardSchema);