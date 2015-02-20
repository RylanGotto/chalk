/**
 * Created by rylan on 13/02/15.
 */
var express = require('express');
var router = express.Router();
var DataModel = require('../models/datamodel');
var expiry = require('../lib/expiry');
var permissions = require('../lib/permissions');
var jmsg = require('../config/status-responses');
var config = require('../config/config');


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
                    console.log("SUCCESS: " + board.tag + " board was created.");
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
                console.log("SUCCESS: " +  "Number of boards found #" + board.lenth);
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
                console.log("SUCCESS: " + req.auth.username + " accessed their myBoard.");
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
                console.log("SUCCESS: " + board.tag + " accessed");
                res.status(200).json(board);
            });
    });



/***********************************************************************************************************************
 *                     Viewing a user's myBoard
 **********************************************************************************************************************/

/**
 * Requires a valid JWT <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
 * Poll the myBoard database every second, when viewing another users myBoard. Timeout if no new request after one minute
 * Do permissions checks
 */
function polling(req, res, accessTime){
    var populateQuery = [{path:'posts', select: 'id timeout privacyLevel owner content dateCreated img permitted'}, {path:"owner", select:'username'}];
    DataModel.Board.findOne({tag: {$in: [req.body.tag]}}).populate(populateQuery)
        .exec(function (err, board) {
            if (!board) { //fail if no board is found
                return res.status(401).json(jmsg.board_no);
            }


            DataModel.User.findOne({_id: {$in: [board.owner]}}).exec(function(err, owner){
                DataModel.User.findOne({_id: {$in: [req.auth.id]}}).exec(function(err, user){
                    var data = [];

                    //check what type of connection exists between 2 users
                    if (permissions.isFriend(owner.friends, req.auth.id)){

                        //the user is on the board owners friends list
                        console.log("these two are friends");
                        board.posts.forEach(function(post){
                            //push all boards with privacy level 'Public', 'Friends', and all 'Private' boards the users is authorized to view
                            if( (post.privacyLevel == 'Public')||
                                (post.privacyLevel == 'Friends')||
                                (   (post.privacyLevel =='Private') && (permissions.isPermitted(post, req.auth.id)))) {
                                data.push(post);
                            }

                        });
                    } else if (permissions.hasMutualFriends(owner.friends, user.friends)){

                        //these users friends lists have at least one common item
                        console.log("these two have at least one mutual friend");
                        board.posts.forEach(function(post){
                            //push all boards with privacy level 'Public', 'Friends'
                            if( (post.privacyLevel == 'Public')||
                                (post.privacyLevel == 'Friends')) {
                                data.push(post);
                            }
                        });
                    } else {

                        //there is no connection between these users
                        console.log("this user is not connected to the board owner");
                        board.posts.forEach(function(post){
                            //push only 'Public' boards
                            if(post.privacyLevel == 'Public') {
                                data.push(post);
                            }
                        });
                    }


                    if (req.body.timestamp === 0) {
                        res.status(200).json({owner: board.owner.username, posts: data, timestamp: Date.now()});
                    } else if (board.lastModified > req.body.timestamp) {//check to see if the timestamp from client is less than the time modified,
                        // if it is board has been modified and respond with the updated data.


                        res.status(200).json({owner: board.owner.username, posts: data, timestamp: Date.now()});
                    } else if (accessTime + 60000 <= Date.now()) { //If the connection has been open for 60 seconds close it

                        res.status(401).json({message: "Polling finished"});
                    } else { //If the connection is within the 60 second TTL recursively call the polling function until we have a result.
                        setTimeout(function () {

                            polling(req, res, accessTime);
                        }, 1000);
                    }

                });
            });
        });
}

//Start polling another user's myBoard
router.route('/board')
    .post(function(req, res, next){
        if (!req.auth) {
            return res.status(401).send();
        }
        var accessTime = Date.now();
        polling(req, res, accessTime);

    });


module.exports = router;