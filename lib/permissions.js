/**
 * Created by Michael on 2015-01-20.
 */

module.exports = {
    /**
     * Determine whether the requesting user has privileges to view the board
     * @param list An array of the board owners friends
     * @param user The user requesting permission to view the article
     * @returns {boolean}
     */
    isFriend: function(list, user){
        var found = false;
        if (list.length != null){
            list.forEach(function (friend) {
                if (user == friend) found = true;
            });
        }
        return found;
    },

    /**
     *
     * @param article The board or post requesting to be viewed
     * @param user The user requesting permission to view the article
     * @returns {boolean}
     */
    isPermitted: function(article, user){
        var found = false;
        if (article.permitted != null){
            article.permitted.forEach(function(permit) {
                if (user == permit) found = true;

            });
        }
        return found;
    }
};