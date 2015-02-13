var express = require('express');
var bodyParser = require('body-parser');
var DataModel = require('./models/datamodel');
var bcrypt = require('bcrypt');
var jwt = require('jwt-simple');
var config = require('./config');
var jmsg = require('./status-responses');
var gcm = require('./gcm');
var expiry = require('./expiry');
var permissions= require('./permissions');



var app = express();

app.use(bodyParser.json());
app.use(require('./middleware/authtransform'));  //Set JWT middleware
app.use(require('./middleware/jwt-expire'));     //Set JWT-Token Expiration middleware
//app.use(require('./middleware/jwt-user'));     //Set JWT-User Integrity middleware
app.use(require('./middleware/cors'));           //Set CORS middleware


var port = process.env.PORT || 8080; 		     // set our port
var router = express.Router();

//test route to make sure everything is working (accessed at GET http://localhost:8080/api)
router.get('/', function (req, res) {
    res.json(jmsg.welcome);
});


/**
 * Check boards every 5 seconds in order to sanitize the DB and permanently remove expired boards or posts
 */
setInterval(function(){

    var populateQuery = [{path:'posts', select: 'id timeout owner dateCreated'}, {path:"owner"}];
    //Populate return objects with their respective own objects and post objects
    DataModel.Board.find().populate(populateQuery)
        .exec(function (err, boards) {
            if (err) {
                return next(err);
            }
            if (boards) {
                expiry.pruneArray(boards); //Prune array for expired posts and boards
            }
        });
}, 5000);







/***********************************************************************************************************************
 *                      Auth
 **********************************************************************************************************************/

/**
 * Register a new uesr. The process of registering includes.
 * Check to make sure email does not exists. Check to make sure username does not exists if so fail with a 401.
 * Create a new user object from datamodel. Set username, email and profile image from request body.
 * Create a new password hash and set password attribute of user object with it.
 * Create a new board title <username>'s Board. TTL is set as 0 to indicate infinite. Set board owner as newly created user
 * Save new board and new user and respond with 200 and success msg
 */
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
                        user.firstname = req.body.firstname;
                        user.lastname = req.body.lastname;
                        user.username = req.body.username;
                        user.email = req.body.email;
                        user.profileImage = req.body.img;

                        bcrypt.hash(req.body.password, 10, function (err, hash) { //Hash Password
                            user.password = hash;
                            user.save(function (err, user) {
                                if (err) {

                                    return (next(err));
                                }

                                var userBoard = new DataModel.Board();
                                userBoard.privacyLevel = 'Public';
                                userBoard.owner = user._id;
                                userBoard.maxTTL = 0;
                                userBoard.tag = user.username + "'s Board";
                                userBoard.dateCreated = Date.now();
                                userBoard.lastModified = Date.now();
                                userBoard.timeout = 0;
                                userBoard.save();
                                console.log(userBoard);
                                res.status(200).json(jmsg.reg);
                            });
                        });
                    });
            });
    });


/**
 * Login a new user. The process of loging in includes.
 * Check to see if user name exists, if not, fail with a 401, invalid login msg
 * If the user name does exists, compare plain text password with hash from DB with bcrypt.compare
 * If valid generate a JWT for user. The JWT contains. expire time, username, and user id.
 * Return with 200, with user info and JWT
 */
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

function polling(req, res, accessTime){
    var populateQuery = [{path:'posts', select: 'id timeout privacyLevel owner content dateCreated img permitted'}, {path:"owner", select:'username'}];
    DataModel.Board.findOne({tag: {$in: [req.body.tag]}}).populate(populateQuery)
        .exec(function (err, board) {
            if (!board) { //fail if no board is found
                return res.status(401).json(jmsg.board_no);
            }


            //console.log(board.lastModified);
            //console.log(req.body.timestamp);
            var data = [];
            var isFriend = false;
            DataModel.User.findOne({_id: {$in: [board.owner]}}).exec(isFriend = function(err, owner){
                isFriend = permissions.isFriend(owner.friends, req.auth.id);
                return isFriend
            });

            if(isFriend){
                board.posts.forEach(function(post){
                    if( (post.privacyLevel == 'Public')||
                        (post.privacyLevel == 'Friends')||
                        (   (post.privacyLevel =='Private') && (permissions.isPermitted(post, req.auth.id)))) {
                        data.push(post);
                    }

                });
            } else {
                board.posts.forEach(function(post){
                    if (post.privacyLevel == 'Public'){
                        data.push(post);
                    }
                });
            }

            if (req.body.timestamp === 0) {
                res.status(200).json({posts: data, timestamp: board.lastModified});
            } else if (board.lastModified > req.body.timestamp) {//check to see if the timestamp from client is less than the time modified,
                // if it is board has been modified and respond with the updated data.

                //console.log("Polling data found");
                res.status(200).json({posts: data, timestamp: Date.now()});
            } else if (accessTime + 60000 <= Date.now()) { //If the connection has been open for 60 seconds close it
                //console.log("Polling finished");
                res.status(401).json({message: "Polling finished"});
            } else { //If the connection is within the 60 second TTL recursively call the polling function until we have a result.
                setTimeout(function () {
                    //console.log("123");
                    polling(req, res, accessTime);
                }, 1000);
            }



        });
}


router.route('/board') //Generic test route
    .post(function(req, res, next){
        if (!req.auth) {
            return res.status(401).send();
        }
        var accessTime = Date.now();
        //console.log("polling!");
        polling(req, res, accessTime);

    });

/***********************************************************************************************************************
 *                     Registering for Push Notifications
 **********************************************************************************************************************/

/**
 * Requires a valid JWT <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
 * Register a device when loggin. This route is called everytime the device is ready in order to ensure we have the most
 * current Device Id stored in the DB.
 * Check to find user with <req.auth.id> as query parameter,  if user exists set type and token attribute of the found user object with the
 * proper type and device id.
 */
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

/**
* Requires a valid JWT <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
* Get current login user information, as well as the friends associated with that account.
* Query users collections with <req.auth.id>
*/
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

/**
 * Requires a valid JWT <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
 * Get all registered users objects
 */
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

    .post(function(req, res, next){
        if (!req.auth) {
            return res.status(401).send();
        }
        DataModel.User.findOne({_id: {$in: [req.params.user_id]}}) //Check if user exists and get user.
            .select('password').select('username')
            .exec(function (err, user){
        if(user){
                bcrypt.compare(req.body.oldpassword,
                    user.password, function (err, valid) {  //Compare password hash
                        if (err) {
                            return next(err);
                        }
                        if (valid) {
                            bcrypt.hash(req.body.newpassword, 10, function (err, hash) { //Hash Password
                                user.password = hash;
                                user.save();

                                    res.status(200).json(jmsg.reg);
                                });

                        }else{

                            return res.status(401).send(jmsg.inv_login);
                        }


                    });
            }

        });
    })

/**
 * Requires a valid JWT <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
 * Get a user from user id in the url
 * Return just information about that user NO population.
 */
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
/**
 * Requires a valid JWT <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
 * User update route, Handles creating a friend request and sending it to user.
 * Handles updating of email. TODO: Updated password, Update Profile IMG
 * Handles delete of user.
 * Query Collection with <req.params.user_id>
 */
    .put(function (req, res) {
        if (!req.auth) {
            return res.status(401).send();
        }

        DataModel.User.findOne({_id: {$in: [req.params.user_id]}}, function (err, user) {
            if (err) {
                return next(err);
            }
            if(user) {


                if (req.body.friendusername) {  //If friendusername exists create a new friend requests and notify the requestee
                    var friendRequest = DataModel.FriendRequest();
                    friendRequest.requesteeeName = req.body.friendusername;
                    friendRequest.requesterName = user.username;
                    friendRequest.save(); //Save friend request
                    DataModel.User.findOne({username: {$in: [req.body.friendusername]}}).exec(function (err, user) { //Look for requestee user object
                        if (err) {
                            console.log("GCM data not found");
                        }
                        if (user) {
                            var gcmMessage = "You have a friend request from " + user.username;
                            gcm.sendGcmPushNotification(gcmMessage, [user.token], 2, user.username); //Send requestee a GCM notification with recipt
                            console.log("GCM Friend request sent to " + req.body.friendusername);
                        }
                    });
                    res.status(200).json({message: req.body.friendusername + " was added sent a friend request!"});
                }
                if (req.body.email) {
                    DataModel.User.findOne({email: {$in: [req.body.email]}}, function (err, userToExist) {
                        if (err) {
                            return next(err);
                        }
                        if (!userToExist) {
                            user.email = req.body.email;
                            user.save();
                            res.status(200).json({email: user.email});
                        } else {
                            res.status(401).json(jmsg.email_ex);
                        }
                    });

                }

                if (req.body.username) {
                    DataModel.User.findOne({username: {$in: [req.body.username]}}, function (err, userToExist) {
                        if (err) {
                            return next(err);
                        }
                        if (!userToExist) {
                            var oldBoardTag = user.username + "'s Board";
                            var newBoardTag = req.body.username + "'s Board";
                            DataModel.Board.findOne({tag: {$in: [oldBoardTag]}}).select('tag') //
                                .exec(function (err, board) {
                                    if (err) {
                                        return next(err);
                                    }
                                    if (board) {
                                        board.tag = newBoardTag;
                                        console.log(board);
                                        board.save();
                                    }
                                });


                            user.username = req.body.username;
                            var token = jwt.encode({
                                username: user.username, exp: new Date().getTime() + config.exp, id: user._id
                            }, config.secret);

                            user.save();
                            res.status(200).json({username: user.username, token: token});

                        } else {
                            res.status(401).json(jmsg.user_ex);
                        }
                    });

                }

                if (req.body.maxTTL) {
                    user.maxTTL = req.body.maxTTL;
                    user.save();
                    res.status(200).json({maxTTL: user.maxTTL});
                }

                if (req.body.img) {
                    user.profileImage = req.body.img;
                    user.save();
                    res.status(200).json();
                }

            }else{
                res.status(401).json(jmsg.user_ex);
            }

    })





    })
    .delete(function(req, res){


        if (!req.auth) {
            return res.status(401).send();
        }
            DataModel.User.findOne({_id: {$in: [req.auth.id]}}).remove().exec( function (err) {
                if (err) {
                    res.status(401).json(err);
                } else {
                    res.status(200).json(jmsg.user_del);
                }
            });


    });
/***********************************************************************************************************************
 *                      Friend Requests
 **********************************************************************************************************************/

router.route('/friendRequest')
/**
 * Requires a valid JWT <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
 * Returns friend requests for a requestee. Used to check for friend requests that are pending.
 * Use <req.auth.username> to query collection
 */
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
/**
 * Requires a valid JWT <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
 * Accept Or Decline a friend request. The process of registering includes.
 * Check <req.body.decision> if false, return back 200. If exists find friend request based on friend request ID passed in from <req.body.friendRequestID>
 * If request exist, find the requestee and requester user objects.
 * If users exist, push user[0] into user[1] friend array and vise versa.
 * Return with 200 and send a gcm push notification to the requster's device indicating the friend request was excepted.
 */
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
/**
 * Requires a valid JWT <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
 * Create a new board. Check if the board tag already exists, fail with 401 if it does.
 * If it does not, create a new board with the current time as the board created time and return with 200
 */
    .post(function (req, res, next) {

        if (!req.auth) {
            return res.status(401).json(jmsg.toke_unauth);

        }

        DataModel.Board.findOne({tag: {$in: [req.body.tag]}}).select('tag') //
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
                board.timeout = expiry.convertToMilliseconds(req.body.timeout);
                board.maxTTL = req.body.maxTTL
                board.dateCreated  = Date.now();
                board.lastModified  = Date.now();

                // save the bear and check for errors
                board.save(function (err) {
                    if (err) {
                        return next(err);
                    }
                    res.status(200).json(jmsg.board_cre);
                });
            });


    })

/**
 * Requires a valid JWT <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
 * Get all boards which belong to the current logged in user.
 * Use <req.auth.id> to query collection and prune the returned array for expired boards/posts,
 * return with 200 if the boards are found.
 */
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


router.route('/myboard')
/**
 * Requires a valid JWT <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
 * Get the current logged in user's myBoard. Use <req.auth.username> to query collection.
 * Populate the myBoard object with all the posts as well as thier owners.
 * Prune the array for expire posts and return the with 200, and the board/posts
 */
.get(function (req, res) {
        if (!req.auth) {
            return res.status(401).send();
        }
        console.log(req.auth.username);
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


/**
 * Requires a valid JWT <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
 * Get a board and all of its posts based on the tag passed in from the params.
 * Use <req.params.board_tag> to query collection
 */
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

/**
 * Requires a valid JWT <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
 * Create a new post. The process of registering includes.
 * Check if the board exists. Create a new Post, check if a photo exists, if it does set the img attribute.
 * Check the time out is valid, if it is convert to milliseconds.
 * Query the user collections for the board owner's device ID and username then send that user a GCM notification with recipt.
 * If all is valid, push new post in the board's post array.
 */
router.route('/posts')

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
                            console.log(req.auth.username + " posted on " + user.username +"'s Board");
                        } });
                    board.posts.push(post._id);
                    board.lastModified = Date.now();
                    console.log("post created at: " + board.lastModified);
                    board.save();
                    res.status(200).json(jmsg.post_cre);
                });
            });

    });


/**
 * Not functional. May only be Delete we will see
 */
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
        DataModel.Post.findById(req.params.post_id, function (err, post) {

            if (err)
                res.send(err);

            post.name = req.body.name;

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


            DataModel.Board.update({posts: {$in: [req.params.post_id]}}, {$unset: {'posts':  req.params.post_id}}, {$set: {'lastModified': Date.now()}} )

                .exec(function (err, board) {
                    if (err) {
                        return next(err);
                    }
                    if (!board) {
                        console.log("Board not found well deleting post");
                    }
                });


            res.status(200).json(jmsg.post_del);
        });
    });


// REGISTER OUR ROUTES -------------------------------
// all of our routes will be prefixed with /api
app.use('/api', router);


app.listen(port);
console.log('Magic happens on port ' + port);
