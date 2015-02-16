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
        if(searchTerms.length == 2) { //assume element zero is first name, and element one is second name and look for matches.
            //also look for board tag based on the entire search query



            DataModel.User.find({$or: [{username: regexSearch}, {lastname: regexLast}, {firstname: regexFirst}]}).exec(function (err, matchs) {

                if (matchs) {
                    matchs.forEach(function (user) {
                        userInfo = user.username + " - " + user.firstname + " " + user.lastname;
                        users.push({userInfo: userInfo, username: user.username});
                    });
                    console.log(matchs);
                }


                return res.status(200).send(users);
            });
        }

        else{ //search username firstname last name and board
            var users = [];
            DataModel.User.find({$or: [{username: regexSearch}, {lastname: regexSearch}, {firstname: regexSearch}]}).exec(function(err, matchs){

                if(matchs){
                    matchs.forEach(function(user){
                        userInfo = user.username + " - " + user.firstname + " " + user.lastname;
                        users.push({userInfo: userInfo, username: user.username});
                    });
                    console.log(matchs);
                }






                return res.status(200).send(users);

            });



        }

    });


module.exports = router;







