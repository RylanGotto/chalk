var express = require('express');
var bodyParser = require('body-parser');
var DataModel = require('./models/datamodel');
var bcrypt = require('bcrypt');
var jwt = require('jwt-simple');
var jwtconfig = require('./jwt-config');                      // Tokens are signed for 3 mintues in milliseconds



var app = express();

app.use(bodyParser.json());
app.use(require('./middleware/authtransform'));  //Set JWT middleware
app.use(require('./middleware/jwt-expire'));     //Set JWT-Token Expiration middleware
app.use(require('./middleware/jwt-user'));       //Set JWT-User Integrity middleware
app.use(require('./middleware/cors'));           //Set CORS middleware

var port = process.env.PORT || 8080; 		     // set our port
var router = express.Router();

//test route to make sure everything is working (accessed at GET http://localhost:8080/api)
router.get('/', function(req, res) {
    res.json({ message: 'hooray! welcome to our api!' });
});

/***********************************************************************************************************************
 *                      Auth
 **********************************************************************************************************************/
router.route('/auth/register')
    //register
    .post(function(req, res, next) {
        var user = new DataModel.User();
        user.username = req.body.username;
        user.email = req.body.email;
        user.profileImage = "no image right now :(" ;
        bcrypt.hash(req.body.password, 10, function (err, hash) {
                user.password = hash;
                user.save(function(err,user) {
                        if(err) { return(next(err)); }
                        res.status(200).send();

                });
        });
});

router.route('/auth/login')
    //login
    .post(function(req, res, next) {
        DataModel.User.findOne({username: { $in: [req.body.username] } })
            .select('password').select('username')
            .exec(function (err, user) {
                    if (err) { return next(err); }
                    if (!user) { return res.status(401).send(); }
                    bcrypt.compare(req.body.password,
                        user.password, function (err, valid) {
                                if (err) { return next(err); }
                                if (!valid) { return res.status(401).send(); }
                                var token = jwt.encode({
                                        username: user.username, exp: new Date().getTime() + jwtconfig.exp, id: user._id
                                }, jwtconfig.secret);
                                res.status(200).send(token);
                 });
        });

    });

/***********************************************************************************************************************
 *                      Users
 **********************************************************************************************************************/
router.route('/users')

    // return user object
    .post(function(req, res, next) {
            if (!req.auth) {
                    return res.status(401).send();
            }

            DataModel.User.findOne({username: { $in: [req.auth.username] } }, function (err, user) {
                    if (err) { return next(err); }
                    res.status(200).json(user);
            });
    })

        //return all user objects
    .get(function(req, res) {
            if (!req.auth) {
                    return res.status(401).send();
            }
            DataModel.User.find(function(err, users) {
                    if (err)
                            res.send(err);
                    res.status(200).json(users);
            });
    });

/***********************************************************************************************************************
 *                      POSTS
 **********************************************************************************************************************/
router.route('/posts')

    .post(function(req, res, next) {
            if (!req.auth) {
                    return res.status(401).send();
            }
            var post = new DataModel.Post();        // create a new instance of the post model
            post.content = req.body.content;  // set the post content (comes from the request)
            post.author_id = req.body.author_id;

            // save the bear and check for errors
            post.save(function(err) {
                    if(err) { return(next(err)); }
                        res.status(200).send();
            });

    })

        // get all the bears (accessed at GET http://localhost:8080/api/bears)
    .get(function(req, res) {
            if (!req.auth) {
                    return res.status(401).send();
            }
            DataModel.Post.find(function(err, posts) {
                    if (err)
                            res.send(err);

                    res.json(posts);
            });
    });

router.route('/posts/:post_id')

    .get(function(req, res) {
            if (!req.auth) {
                    return res.status(401).send();
            }
            DataModel.Post.findById(req.params.post_id, function(err, post) {
                    if (err)
                            res.send(err);
                    res.json(post);
            });
    })


    .put(function(req, res) {
            if (!req.auth) {
                    return res.status(401).send();
            }
            // use our bear model to find the bear we want
            DataModel.Post.findById(req.params.post_id, function(err, post) {

                    if (err)
                            res.send(err);

                    post.name = req.body.name; 	// update the bears info

                    // save the bear
                    post.save(function(err) {
                            if (err)
                                    res.send(err);

                            res.json({ message: 'Post updated!' });
                    });

            });
    })

    .delete(function(req, res) {
            if (!req.auth) {
                    return res.status(401).send();
            }
            DataModel.Post.remove({
                    _id: req.params.post_id
            }, function(err, post) {
                    if (err)
                            res.send(err);

                    res.json({ message: 'Successfully deleted' });
            });
    });





// REGISTER OUR ROUTES -------------------------------
// all of our routes will be prefixed with /api
app.use('/api', router);


app.listen(port);
console.log('Magic happens on port ' + port);
