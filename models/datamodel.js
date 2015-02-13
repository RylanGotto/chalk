var db = require('./db');
var mongoose = require('../node_modules/mongoose');
var Schema = db.Schema;

var BoardSchema = new Schema({
    posts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post'}],
    privacyLevel: { type: String},
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    maxTTL: Number,
    tag: { type: String},
    timeout: { type: Number}, // Time in minutes that the post lasts for
    dateCreated : { type: Number},
    lastModified: { type: Number},
    permitted: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User'}]
});

var PostSchema = new Schema({
    content: String,
    owner: { type:String, ref: 'User'},
    privacyLevel: String,
    timeout: Number, //Time in minutes that the post lasts for
    dateCreated : { type : Number },
    img: String,
    permitted: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User'}]
});


var UserSchema = new Schema({
    firstname: { type: String},
    lastname: { type: String},
    username: { type: String, required: true},
    password: { type: String, required: true, select: false},
    email: { type: String,  required: true},
    profileImage: { type : String },
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User'}],
    type: { type: 'String'},
    token: { type: 'String'},
    maxTTL : { type: Number, default : 0 }
});

var FriendRequestSchema = new Schema({
    requesterName: String,
    requesteeeName: String
});







var DataModel = {
    Post: db.model('Post', PostSchema),
    User: db.model('User', UserSchema),
    Board: db.model('Board', BoardSchema),
    FriendRequest: db.model('FriendRequest', FriendRequestSchema)
};

module.exports = DataModel;