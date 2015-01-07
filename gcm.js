/**
 * Created by rylan on 06/01/15.
 */
var gcm = require('node-gcm');
var config = require('./config');



sendGcmPushNotification = function (msg, title, msgcnt, registrationIds){
    var message = new gcm.Message();
    var sender = new gcm.Sender(config.gcm_apikey);

    message.addData('message', msg);
    message.addData('title', title);
    message.addData('msgcnt', msgcnt);
    message.timeToLive = 3000;
    //console.log(message);
    return sender.send(message, registrationIds, 4, function (result) {
       console.log(result); //null is actually success
        return result;
    });

}


module.exports = {
    sendGcmPushNotification: sendGcmPushNotification
};