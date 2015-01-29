var express = require('express');
var bodyParser = require('body-parser');
var DataModel = require('./models/datamodel');
var bcrypt = require('bcrypt');
var jwt = require('jwt-simple');
var config = require('./config');                      // Tokens are signed for 3 mintues in milliseconds
var jmsg = require('./status-responses');
var gcm = require('./gcm');
var expiry = require('./expiry');



var app = express();

app.use(bodyParser.json());
app.use(require('./middleware/authtransform'));  //Set JWT middleware
app.use(require('./middleware/jwt-expire'));     //Set JWT-Token Expiration middleware
//app.use(require('./middleware/jwt-user'));       //Set JWT-User Integrity middleware
app.use(require('./middleware/cors'));           //Set CORS middleware


var port = process.env.PORT || 8080; 		     // set our port
var router = express.Router();

//test route to make sure everything is working (accessed at GET http://localhost:8080/api)
router.get('/', function (req, res) {
    res.json(jmsg.welcome);
});





    setInterval(function(){

        var populateQuery = [{path:'posts', select: 'id timeout owner dateCreated'}, {path:"owner"}];
        DataModel.Board.find().populate(populateQuery)
            .exec(function (err, boards) {
                if (err) {
                    return next(err);
                }
                if (boards) {
                    expiry.pruneArray(boards);
                }
            });
    }, 5000);







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
                            username: user.username, exp: new Date().getTime() + config.exp, id: user._id
                        }, config.secret);
                        res.status(200).json({tok: token, usr: user});
                    });
            });

    });


router.route('/test')
    .post(function(req, res, next){
        console.log(req.body.data);
        res.status(200).json(req.body.data);
    });

/***********************************************************************************************************************
 *                     Registering for Push Notifications
 **********************************************************************************************************************/
router.route('/push/subscribe')

.post(function (req, res, next) {
        if (!req.auth) {
            return res.status(401).send();
        }
        DataModel.User.findOne({_id: {$in: [req.auth.id]}}).exec(function (err, user) {
            if (err) {
                return next(err);
            }
            if(user){
                user.type = req.body.type;
                user.token = req.body.token;
                user.save();
                console.log(user.username + " has registered a device");
            }

        });
        res.status(200).json(jmsg.dev_reg);
    });





router.route('/push/unsubscribe')

    .post(function (req, res, next) {
        if (!req.auth) {
            return res.status(401).send();
        }

        DataModel.GcmData.remove({
            username: req.auth.username
        }, function (err) {
            if (err)
                res.send(err);
            res.status(200).json(jmsg.dev_del);
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
            if(req.body.friendusername){
                var friendRequest = DataModel.FriendRequest();
                friendRequest.requesteeeName = req.body.friendusername;
                friendRequest.requesterName =  user.username;
                friendRequest.save();
                DataModel.User.findOne({username: {$in: [req.body.friendusername]}}).exec( function (err, user) {
                    if (err) {
                        console.log("GCM data not found");
                    }
                    if (user){
                       var gcmMessage = "You have a friend request from " + user.username;
                       gcm.sendGcmPushNotification(gcmMessage, [user.token], 2, user.username);
                       console.log("GCM Friend request sent to " + req.body.friendusername);
                    }
                });


                res.status(200).json({message: req.body.friendusername + " was added sent a friend request!"});
            }
            if(req.body.email){
                user.email = req.body.email;
                user.save();
                res.status(200).json(user);
            }
            if(req.body.delete){


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
 *                      Friend Requests
 **********************************************************************************************************************/
router.route('/friendRequest')

    .get(function(req, res, next){
        if (!req.auth) {
            return res.status(401).json(jmsg.toke_unauth);

        }
        DataModel.FriendRequest.find({requesteeeName: {$in: [req.auth.username]}}).exec(function(err, requests){
            if(requests){
                console.log(requests.length + " Friend requests found for user " + req.auth.username);
                return res.status(200).json(requests);
            } else {
                console.log("No Friend requests found for user " + req.auth.username);
                return res.status(401).json();
            }
        });
    })
    .post(function(req, res, next){
        if (!req.auth) {
            return res.status(401).json(jmsg.toke_unauth);
        }
        if(req.body.decision){
            console.log(req.body.friendRequestID);
            DataModel.FriendRequest.findOne({_id: {$in: [req.body.friendRequestID]}})
                .exec(function (err, request) {
                    if(request){
                        console.log("Friend requests found for user " + req.auth.username);

                        DataModel.User.find({username: {$in: [request.requesteeeName, request.requesterName]}}).exec(function(err, users){
                            if(users){

                                users[0].friends.push(users[1]);
                                users[0].save();
                                users[1].friends.push(users[0]);
                                users[1].save();

                                console.log(users[0].username + " has added " + users[1].username + " to their friends list.");
                                console.log(users[1].username + " has added " + users[0].username + " to their friends list.");

                                var gcmMessage = users[0].username + " has accpeted your friend request!";
                                gcm.sendGcmPushNotification(gcmMessage, [users[1].token], 1, users[0].username);

                                //return res.status(200).json(request);
                            } else {
                                console.log("No users found with those usernames ");

                            }
                        });

                    } else {
                        console.log("No Friend requests found for user " + req.auth.username);

                    }
                });

        } else {
            console.log("Friend request denied by " + req.auth.username);
        }
        DataModel.FriendRequest.findOne({_id: {$in: [req.body.friendRequestID]}}).remove(function(err, request){
            if(request){
                console.log("Friend request removed");
                return res.status(200).json("fail");
            } else {
                console.log("No friend requests to remove");
                return res.status(200).json("fail");
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
                    return res.status(409).json(jmsg.board_ex);
                }

                var board = new DataModel.Board();
                board.tag = req.body.tag;
                board.owner = req.auth.id;
                board.privacyLevel = String(req.body.privacyLevel);
                board.timeout = expiry.convertToMilliseconds(req.body.timeout);
                board.maxTTL = req.body.maxTTL
                board.dateCreated  = Date.now();

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
                expiry.pruneArray(board);
                res.status(200).json(board);
            });
    });

//get my board
router.route('/myboard')
.get(function (req, res) {
        if (!req.auth) {
            return res.status(401).send();
        }
        var populateQuery = [{path:'posts', select: 'id timeout privacyLevel owner content dateCreated img'}, {path:"owner", select:'username'}];
        DataModel.Board.findOne({tag: {$in: [req.auth.username + "'s Board"]}}).populate(populateQuery)
            .exec(function (err, board) {
                if (err) {
                    return next(err);
                }
                if (!board) {
                    return res.status(401).json(jmsg.board_no);
                }

                var posts = expiry.pruneArray(board.posts);
                res.status(200).json(posts);
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
                expiry.pruneArray(board.posts);
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
        DataModel.Board.findOne({tag: {$in: [req.body.tag]}}).populate("owner")
            .exec(function (err, board) {
                if (err) {
                    return next(err);
                }
                if (!board) {
                    return res.status(401).json(jmsg.board_no);
                }
                var post = new DataModel.Post();        // create a new instance of the post model
                post.content = req.body.content;  // set the post content (comes from the request)
                post.owner = req.auth.username;
                post.privacyLevel = req.body.privacyLevel;
                post.dateCreated  = Date.now();
                if(req.body.img){
                    post.img = req.body.img;
                }


                if( /^\+?[1-9]\d*$/.test(req.body.timeout) ) {
                    post.timeout = expiry.convertToMilliseconds(req.body.timeout);
                } else {
                    return res.status(406).json(req.body.timeout + " must be positive integer");
                }
                // save the post and check for errors
                post.save(function (err) {
                    if (err) {
                        return (next(err));
                    }
                    DataModel.User.findOne({username: board.owner.username}, function(err, user){
                        if(user) {
                        	var gcmMessage = 'You have a new post on myBoard from ' + req.auth.username;
                            gcm.sendGcmPushNotification(gcmMessage , [user.token], 0, req.auth.username);
                            console.log(req.auth.username + " posted on " + user.username +"'s Board Homie");
                        } });
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
