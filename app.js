var express = require('express');
var logger = require('morgan');
var bodyParser = require('body-parser');
var jmsg = require('./config/status-responses');




var app = express();

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(require('./middleware/authtransform'));  //Set JWT middleware
app.use(require('./middleware/jwt-expire'));     //Set JWT-Token Expiration middleware
app.use(require('./middleware/cors'));           //Set CORS middleware


var port = process.env.PORT || 8080; 		     // set our port
var router = express.Router();

var initRouter = require('./routes/init');
var postsRouter = require('./routes/posts');
var usersRouter = require('./routes/users');
var boardsRouter = require('./routes/boards');

//test route to make sure everything is working (accessed at GET http://localhost:8080/api)
router.get('/', function (req, res) {
    res.json(jmsg.welcome);
});


// REGISTER OUR ROUTES -------------------------------
// all of our routes will be prefixed with /api
app.use('/api', router);
app.use('/api', initRouter);
app.use('/api', postsRouter);
app.use('/api', usersRouter);
app.use('/api', boardsRouter);


// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});


console.log('Magic happens on port ' + port);

module.exports = app;
