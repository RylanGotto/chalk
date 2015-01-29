var mongoose = require('../node_modules/mongoose');
var dbName = "cc654";
mongoose.connect('mongodb://dbuser:dbuser@ds061620.mongolab.com:61620/chalk', function () {
    console.log('chalkin it up on ' + dbName + "!");
});
module.exports = mongoose;
