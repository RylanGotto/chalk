/**
 * Created by rylan on 13/02/15.
 */
var express = require('express');
var router = express.Router();
var DataModel = require('../models/datamodel');
var bcrypt = require('bcrypt');
var jwt = require('jwt-simple');
var gcm = require('../lib/gcm');
var jmsg = require('../config/status-responses');
var config = require('../config/config');



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


module.exports = router;