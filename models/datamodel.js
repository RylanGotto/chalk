var db = require('./db');
var mongoose = require('../node_modules/mongoose');
var Schema = db.Schema;

var BoardSchema = new Schema({
    posts: [{type: mongoose.Schema.Types.ObjectId, ref: 'Post'}],
    privacyLevel: String,
    owner: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    maxTTL: Number,
    tag: String,
    timeout: Number,
    time : { type : Date, default: Date.now }
});

var PostSchema = new Schema({
    content: String,
    owner: {type:String, ref: 'User'},
    privacyLevel: String,
    timeout: Number,
    time : { type : Date, default: Date.now }
});


var UserSchema = new Schema({
    username: {type: String, required: true},
    password: {type: String, required: true, select: false},
    email: {type: String, select: false, required: true},
    profileImage: String,
    friends: [{type: Schema.ObjectId, ref: 'User'}]
});


var DataModel = {
    Post: db.model('Post', PostSchema),
    User: db.model('User', UserSchema),
    Board: db.model('Board', BoardSchema)
};

module.exports = DataModel;