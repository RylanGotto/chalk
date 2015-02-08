var mongoose = require('../node_modules/mongoose');
var dbName = "rylan";
mongoose.connect('mongodb://localhost:27017/' + dbName, function () {
    console.log('chalkin it up on ' + dbName + "!");
});
module.exports = mongoose;
