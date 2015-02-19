/**
 * Created by rylan on 15/02/15.
 */

var express = require('express');
var router = express.Router();
var DataModel = require('../models/datamodel');
router.route('/search')
    .post(function(req, res, next){
        if (!req.auth) {
            return res.status(401).send();
        }

        var searchTerms = req.body.searchQuery.split(" ");
        var regexSearch = new RegExp(req.body.searchQuery, 'i');
        var regexFirst = new RegExp(searchTerms[0], 'i');
        var regexLast = new RegExp(searchTerms[1], 'i');
        var users = [];
        var userID = [];
        if(searchTerms.length == 2) { //assume element zero is first name, and element one is second name and look for matches.
            //also look for board tag based on the entire search query



            DataModel.User.find({$or: [{username: regexSearch}, {lastname: regexLast}, {firstname: regexFirst}]}).exec(function (err, matches) {

                if (matches) {
                    matches.forEach(function (user) {
                        userInfo = user.username + " - " + user.firstname + " " + user.lastname;
                        users.push({userInfo: userInfo, username: user.username});
                        userID.push(user._id);
                    });
                }
                DataModel.Board.find({owner: {$not: {$in:userID}}, tag: regexSearch}).exec(function (err, boards) {
                    if (err) {
                        return next(err);
                    }
                    if (!boards) {
                        return res.status(401).json(jmsg.board_ex);
                    }else{
                        return res.status(200).send({users: users, boards: boards});
                    }
                });
            });
        }
        else{ //search username firstname last name and board

            DataModel.User.find({$or: [{username: regexSearch}, {lastname: regexSearch}, {firstname: regexSearch}]}).exec(function(err, matches){

                if(matches){
                    matches.forEach(function(user){
                        userInfo = user.username + " - " + user.firstname + " " + user.lastname;
                        users.push({userInfo: userInfo, username: user.username});
                        userID.push(user._id);
                    });
                }
                DataModel.Board.find({owner: {$not: {$in:userID}}, tag: regexSearch}).exec(function (err, boards) {
                    if (err) {
                        return next(err);
                    }
                    console.log(boards);
                    if (!boards) {
                        return res.status(401).json(jmsg.board_ex);
                    }else{
                        return res.status(200).send({users: users, boards: boards});
                    }
                });








            });



        }

    });


module.exports = router;







