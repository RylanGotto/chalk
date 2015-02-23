/**
 * Created by rylan on 15/02/15.
 */

var express = require('express');
var router = express.Router();
var DataModel = require('../models/datamodel');
var permissions = require('../lib/permissions');

router.route('/search')
    .post(function(req, res, next) {
        if (!req.auth) {
            return res.status(401).send();
        }

        var searchTerms = req.body.searchQuery.split(" ");
        var regexSearch = new RegExp(req.body.searchQuery, 'i');
        var regexFirst = new RegExp(searchTerms[0], 'i');
        var regexLast = new RegExp(searchTerms[1], 'i');
        var users = [];
        var userID = [];

        if (searchTerms.length == 2) {
            search(regexSearch, regexLast, regexFirst)
        } else {
            search(regexSearch, regexSearch, regexSearch)
        }

        function search(term1, term2, term3) {
            DataModel.User.find({$or: [{username: term1}, {lastname: term2}, {firstname: term3}]}).exec(function (err, matches) {

                if (matches) {
                    matches.forEach(function (user) {
                        userInfo = user.username + " - " + user.firstname + " " + user.lastname;
                        users.push({userInfo: userInfo, username: user.username});
                        userID.push(user._id);
                    });
                }
                DataModel.Board.find({
                    owner: {$not: {$in: userID}},
                    tag: term1
                }).populate('owner').exec(function (err, boards) {
                    if (err) {
                        return next(err);
                    }
                    if (!boards) {
                        return res.status(401).json(jmsg.board_ex);
                    } else {
                        var data = [];

                        DataModel.User.findOne({_id: {$in: [req.auth.id]}}).exec(function (err, user) {
                            boards.forEach(function (board) {
                                var isFriendsOrMutualFriend = (permissions.isFriend(board.owner.friends, req.auth.id) || permissions.hasMutualFriends(board.owner.friends, user.friends));
                                if (board.privacyLevel == 'Public') {
                                    console.log(board.tag);
                                    data.push(board);
                                } else if ((board.privacyLevel == 'Friends') && (isFriendsOrMutualFriend)) {
                                    console.log(board.tag);
                                    data.push(board);
                                } else if ((board.privacyLevel == 'Private') && (isFriendsOrMutualFriend) && (permissions.isPermitted(board, req.auth.id))) {
                                    console.log(board.tag);
                                    data.push(board);
                                }
                            });
                            return res.status(200).send({users: users, boards: data});
                        });
                    }

                    /*



                     boards.forEach(function (board){
                     DataModel.User.findOne({_id: {$in: [board.owner]}}).exec(function(err, owner){
                     DataModel.User.findOne({_id: {$in: [req.auth.id]}}).exec(function(err, user){
                     isFriendsOrMutualFriend = (permissions.isFriend(owner.friends, req.auth.id) || permissions.hasMutualFriends(owner.friends, user.friends));
                     if (board.privacyLevel == 'Public'){
                     data.push(board);
                     } else if ((board.privacyLevel == 'Friends') && (isFriendsOrMutualFriend)){
                     data.push(board);
                     } else if ((board.privacyLevel == 'Private') && (isFriendsOrMutualFriend) && (permissions.isPermitted(board, req.auth.id))){
                     data.push(board);
                     }
                     });
                     });
                     });
                     return res.status(200).send({users: users, boards: data}); //data is empty here, should have boards
                     }

                     */
                });
            });
        }

    });
module.exports = router;
