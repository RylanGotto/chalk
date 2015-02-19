/**
 * Created by rylan on 13/02/15.
 */
var express = require('express');
var router = express.Router();
var DataModel = require('../models/datamodel');
var bcrypt = require('bcrypt');
var jwt = require('jwt-simple');
var jmsg = require('../config/status-responses');
var config = require('../config/config');










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

                                userBoard.timeout = 0;
                                userBoard.save();
                                console.log("SUCCESS: " + user.username + " Registered.");
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
                        console.log("SUCCESS: " + user.username + " Signed in.");
                        res.status(200).json({tok: token, usr: user});
                    });
            });

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
                console.log("SUCCESS: " + user.username + " has registered a device");
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
            console.log("SUCCESS: " + user.username + " has unregistered a device");
            res.status(200).json(jmsg.dev_del);
        });

    });




module.exports = router;