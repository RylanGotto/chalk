var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var PostSchema   = new Schema({
    content: String,
    author_id: { type: String, ref: 'User' }
});

module.exports = mongoose.model('Post', PostSchema);
