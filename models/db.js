var mongoose = require('../node_modules/mongoose');

mongoose.connect('mongodb://localhost:27017/chalk', function () {
    console.log('chalkin it up!');
});
module.exports = mongoose;
