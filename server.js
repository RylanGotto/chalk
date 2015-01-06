var express = require('express');
var bodyParser = require('body-parser');
var DataModel = require('./models/datamodel');
var bcrypt = require('bcrypt');
var jwt = require('jwt-simple');
var jwtconfig = require('./jwt-config');                      // Tokens are signed for 3 mintues in milliseconds
var jmsg = require('./status-responses');


var app = express();

app.use(bodyParser.json());
app.use(require('./middleware/authtransform'));  //Set JWT middleware
app.use(require('./middleware/jwt-expire'));     //Set JWT-Token Expiration middleware
app.use(require('./middleware/jwt-user'));       //Set JWT-User Integrity middleware
app.use(require('./middleware/cors'));           //Set CORS middleware

var port = process.env.PORT || 8080; 		     // set our port
var router = express.Router();

//test route to make sure everything is working (accessed at GET http://localhost:8080/api)
router.get('/', function (req, res) {
    res.json(jmsg.welcome);
});



/***********************************************************************************************************************
 *                      Push Notification Registering
 **********************************************************************************************************************/







/***********************************************************************************************************************
 *                      Auth
 **********************************************************************************************************************/
router.route('/auth/register')
    //register
    .post(function (req, res, next) {
        DataModel.User.findOne({email: {$in: [req.body.email]}}).select('email') //Check to make sure email is not already registered
            .exec(function (err, user) {
                if (err) {
                    return next(err);
                }
                ;
                if (user) {
                    return res.status(401).json(jmsg.email_ex);
                }
                DataModel.User.findOne({username: {$in: [req.body.username]}}).select('username') //Check to make sure username is not already registered
                    .exec(function (err, user) {
                        if (err) {
                            return next(err);
                        }
                        if (user) {
                            return res.status(401).json(jmsg.user_ex);
                        }


                        var user = new DataModel.User();
                        user.username = req.body.username;
                        user.email = req.body.email;
                        user.profileImage = "no image right now :(";


                        bcrypt.hash(req.body.password, 10, function (err, hash) { //Hash Password
                            user.password = hash;
                            user.save(function (err, user) {
                                if (err) {
                                    return (next(err));
                                }

                                var userBoard = new DataModel.Board();
                                userBoard.privacyLevel = 0;
                                userBoard.owner = user._id;
                                userBoard.maxTTL = 0;
                                userBoard.tag = user.username + "'s Board";
                                userBoard.timeout = 0;
                                userBoard.save();

                                res.status(200).json(jmsg.reg);
                            });
                        });
                    });
            });
    });

router.route('/auth/login')
    //login
    .post(function (req, res, next) {
        DataModel.User.findOne({username: {$in: [req.body.username]}}) //Check if user exists and get user.
            .select('password').select('username')
            .exec(function (err, user) {
                if (err) {
                    return next(err);
                }
                if (!user) {
                    return res.status(401).send(jmsg.inv_login);
                }
                bcrypt.compare(req.body.password,
                    user.password, function (err, valid) {  //Compare password hash
                        if (err) {
                            return next(err);
                        }
                        if (!valid) {
                            return res.status(401).send(jmsg.inv_login);
                        }
                        var token = jwt.encode({
                            username: user.username, exp: new Date().getTime() + jwtconfig.exp, id: user._id
                        }, jwtconfig.secret);
                        res.status(200).json({tok: token, usr: user});
                    });
            });

    });

/***********************************************************************************************************************
 *                      Users
 **********************************************************************************************************************/
router.route('/users')

    // return the current logged in user object and all friends
    .post(function (req, res, next) {
        if (!req.auth) {
            return res.status(401).send();
        }

        DataModel.User.findOne({_id: {$in: [req.auth.id]}}).populate("friends").exec(function (err, user) {
            if (err) {
                return next(err);
            }
            console.log(user);
            res.status(200).json(user);
        });
    })

    //return all user objects
    .get(function (req, res) {
        if (!req.auth) {
            return res.status(401).send();
        }
        DataModel.User.find(function (err, users) {
            if (err)
                res.send(err);
            res.status(200).json(users);
        });
    });



router.route('/users/:user_id')

    //return a single user objects
    .get(function (req, res) {
        if (!req.auth) {
            return res.status(401).send();
        }
        DataModel.User.findOne({_id: {$in: [req.params.user_id]}}, function (err, user) {
            if (err) {
                return next(err);
            }
            res.status(200).json(user);
        });
    })

    .put(function (req, res) {
        if (!req.auth) {
            return res.status(401).send();
        }
        DataModel.User.findOne({_id: {$in: [req.params.user_id]}}, function (err, user) {
            if (err) {
                return next(err);
            }
            if(req.body.friendid){
                user.friends.push(req.body.friendid);
                user.save();
                console.log(user);
                res.status(200).json({message: req.body.frndname + " was added to your friends list"});
            }
            if(req.body.email){
                user.email = req.body.email;
                user.save();
                res.status(200).json(user);
            }
            if(req.body.delete){

            var message;
                DataModel.User.findOne({_id: {$in: [req.body.delete]}}).remove().exec( function (err) {
                    if (err) {
                        res.status(200).json(err);
                    } else {
                        res.status(200).json(jmsg.user_del);
                    }
                });

            }

        });




    });


/***********************************************************************************************************************
 *                      Boards
 **********************************************************************************************************************/
router.route('/boards')
    //create a new board
    .post(function (req, res, next) {

        if (!req.auth) {
            return res.status(401).json(jmsg.toke_unauth);

        }
        DataModel.Board.findOne({tag: {$in: [req.body.tag]}}).select('tag')
            .exec(function (err, board) {
                if (err) {
                    return next(err);
                }
                if (board) {
                    return res.status(401).json(jmsg.board_ex);
                }

                var board = new DataModel.Board();
                board.tag = req.body.tag;
                board.owner = req.auth.id;
                board.privacyLevel = String(req.body.privacyLevel);
                board.timeout = req.body.timeout;
                board.maxTTL = req.body.maxTTL

                // save the bear and check for errors
                board.save(function (err) {
                    if (err) {
                        return next(err);
                    }
                    res.status(200).json(jmsg.board_cre);
                });
            });


    })

//find boards published by user
    .get(function (req, res) {
        if (!req.auth) {
            return res.status(401).send();
        }

        DataModel.Board.find({owner: {$in: [req.auth.id]}})
            .exec(function (err, board) {
                if (err) {
                    return next(err);
                }
                if (!board) {
                    return res.status(401).json(jmsg.board_no);
                }
                res.status(200).json(board);
            });
    });

//get my board
router.route('/myboard')
.get(function (req, res) {
        if (!req.auth) {
            return res.status(401).send();
        }
        var populateQuery = [{path:'posts', select: 'id timeout privacyLevel owner content time'}, {path:"owner", select:'username'}];
        DataModel.Board.find({tag: {$in: [req.auth.username + "'s Board"]}}).populate(populateQuery)
            .exec(function (err, board) {
                if (err) {
                    return next(err);
                }
                if (!board) {
                    return res.status(401).json(jmsg.board_no);
                }
                res.status(200).json(board);
            });
    });


//get board by ID and all of its posts
router.route('/boards/:board_tag')

    .get(function (req, res) {
        if (!req.auth) {
            return res.status(401).send();
        }
        DataModel.Board.find({tag: {$in: [req.params.board_tag]}}).populate("posts")
            .exec(function (err, board){
                res.status(200).json(board);
            });


    });




/***********************************************************************************************************************
 *                      POSTS
 **********************************************************************************************************************/
router.route('/posts')
//Create a new post
    .post(function (req, res, next) {
        if (!req.auth) {
            return res.status(401).send();
        }

        DataModel.Board.findOne({tag: {$in: [req.body.tag]}})
            .exec(function (err, board) {
                if (err) {
                    return next(err);
                }
                if (!board) {
                    return res.status(401).json(jmsg.board_no);
                }
                console.log(req.auth);
                var post = new DataModel.Post();        // create a new instance of the post model
                post.content = req.body.content;  // set the post content (comes from the request)
                post.owner = req.auth.username;
                post.privacyLevel = req.body.privacyLevel;
                post.timeout = req.body.timeout;

                // save the post and check for errors
                post.save(function (err) {
                    if (err) {
                        return (next(err));
                    }
                    board.posts.push(post._id);
                    board.save();
                    res.status(200).json(jmsg.post_cre);
                });
            });

    });




//not being user yet.
router.route('/posts/:post_id')

    .get(function (req, res) {
        if (!req.auth) {
            return res.status(401).send();
        }
        DataModel.Post.findById(req.params.post_id, function (err, post) {
            if (err)
                res.send(err);
            res.json(post);
        });
    })


    .put(function (req, res) {
        if (!req.auth) {
            return res.status(401).send();
        }
        // use our bear model to find the bear we want
        DataModel.Post.findById(req.params.post_id, function (err, post) {

            if (err)
                res.send(err);

            post.name = req.body.name; 	// update the bears info

            // save the bear
            post.save(function (err) {
                if (err)
                    res.send(err);

                res.status(200).json(jmsg.post_cre);
            });

        });
    })

    .delete(function (req, res) {
        if (!req.auth) {
            return res.status(401).send();
        }
        DataModel.Post.remove({
            _id: req.params.post_id
        }, function (err, post) {
            if (err)
                res.send(err);

            res.status(200).json(jmsg.post_del);
        });
    });


// REGISTER OUR ROUTES -------------------------------
// all of our routes will be prefixed with /api
app.use('/api', router);


app.listen(port);
console.log('Magic happens on port ' + port);
