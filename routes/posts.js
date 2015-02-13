/**
 * Created by rylan on 13/02/15.
 */
var express = require('express');
var router = express.Router();
var DataModel = require('../models/datamodel');
var gcm = require('../lib/gcm');
var expiry = require('../lib/expiry');
var jmsg = require('../config/status-responses');
var config = require('../config/config');

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
                if(req.body.privacyLevel == 'Private') {
                    post.permitted.push(req.auth.id);
                }
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
                    board.save();
                    res.status(200).json(jmsg.post_cre);
                });
            });

    });


/**
 * Not functional. only Delete works
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

module.exports = router;