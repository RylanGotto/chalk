var DataModel = require('../models/datamodel');
var gcm = require('../lib/gcm');


module.exports = {

    /**
     * Remove expired posts or boards from passed in ar
     * @param articles Array of posts or boards
     */
    pruneArray: function (articles) {
        var goodArticles = [];
        var badArticles = [];
        var articleOwners = [];
        if(articles && articles.constructor === Array) {
            articles.forEach(function (article) {
                if (module.exports.isExpired(article.dateCreated, article.timeout)) {
                    badArticles.push(article);
                } else {
                    //console.log(article.tag + " will expire in " +(((article.dateCreated + article.timeout)-Date.now())) /60000);
                    module.exports.pruneArray(article.posts);
                    goodArticles.push(article);
                }
            });

            badArticles.forEach(function (article) {

                articleOwners.push(article.owner);
                //Only boards have tags
                if (typeof article.tag == "undefined") {
                    //these are posts

                    DataModel.Post.remove({
                        _id: article._id
                    }, function (err) {
                        if (err) {
                            console.log('Error expiring post: ' + article._id);
                        }
                        console.log('post: ' + article.id + ' deleted');
                    });
                } else {
                    // Remove the board + any posts in it.
                    module.exports.pruneArray(article.posts);
                    DataModel.Board.remove({
                        _id: article._id
                    }, function (err) {
                        if (err) {
                            console.log('Error expiring Board: ' + article._id);
                        }
                        console.log('board: ' + article.tag + ' deleted');
                    });
                }
                
            });
        } else {
            // isn't an array or is empty
            //console.log('not an array');
            return null;
        }


        articleOwners.forEach(function(owner){
            DataModel.User.findOne({username: {$in: [owner]}}).select('token') //Check to make sure email is not already registered
                .exec(function (err, user) {
                    if (err) {
                        console.log(err);
                    }
                    if(user){
                        gcm.sendSilentGcmSync([user.token]);
                        console.log("Silent gcm update sent to " + owner);
                    }

                });
        });
        return goodArticles;
    },

    /**
     * Convert minutes to miliseconds
     * @param time Int - a value in minutes
     * @returns {number}
     */
    convertToMilliseconds: function(time) {
        //console.log('timeout converted to ' + (time * 60000) );
        return time * 60000;
    },

    /**
     * Test to see if the datecreated + timeout is less than the current time
     * @param dateCreated post or board date created in UTC
     * @param timeout post or board timeout in ms
     * @returns {boolean}
     */
    isExpired: function(dateCreated, timeout) {
        // Don't expire users boards
        if( timeout === 0 )
            return false;
        else {
            //console.log('why expire? ' + parseInt( dateCreated + timeout ) + ' - vs - ' + parseInt(Date.now()) + ' is: ' + ( parseInt( dateCreated + timeout ) <= parseInt(Date.now()) ) );
            return ( ( dateCreated + timeout ) <= Date.now() );
        }
    }
}
