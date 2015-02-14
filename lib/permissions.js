/**
 * Created by Michael on 2015-01-20.
 */

module.exports = {
    /**
     * Determine whether the requesting user has privileges to view the board
     * @param list An listay of the board owners friends
     * @param user The user requesting permission to view the article
     * @returns {boolean}
     */
    isFriend: function(list, user){
        var found = false;
        if (list.length != 0){
            list.forEach(function (friend) {
                if (user == friend) found = true;
            });
        }
        return found;
    },

    hasMutualFriends: function(list1, list2) {
        if ((list1.length == 0) || (list2.length == 0)) return false;

        var r = [], o = {}, l = list2.length, i, v;
        for (i = 0; i < l; i++) {
            o[list2[i]] = true;
        }
        l = list1.length;
        for (i = 0; i < l; i++) {
            v = list1[i];
            if (v in o) {
                r.push(v);
            }
        }
        return (r.length > 0);
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