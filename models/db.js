var mongoose = require('../node_modules/mongoose');

mongoose.connect('mongodb://dbuser:dbuser@ds061620.mongolab.com:61620/chalk', function () {
    console.log('chalkin it up!');
});
module.exports = mongoose;
