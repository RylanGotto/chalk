var db = require('./db');
var Schema = db.Schema;

var BoardSchema = new Schema({
    posts: [{type: String, ref: 'Post'}],
    privacyLevel: Number,
    owner: {type: String, ref: 'User'},
    maxTTL: Number,
    tag: String,
    timeout: Number
});


var PostSchema = new Schema({
    content: String,
    author_id: {type: String, ref: 'User'}
});


var UserSchema = new Schema({
    username: {type: String, required: true},
    password: {type: String, select: false, required: true},
    email: {type: String, select: false, required: true},
    profileImage: String,
    friends: [{type: String, ref: 'User'}],
    boards: [{type: String, ref: 'Board'}]
});


var DataModel = {
    Post: db.model('Post', PostSchema),
    User: db.model('User', UserSchema),
    Board: db.model('Board', BoardSchema)
};

module.exports = DataModel;
