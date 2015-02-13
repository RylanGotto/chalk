/**
 * Created by rylan on 06/01/15.
 */
var gcm = require('node-gcm');
var config = require('../config/config');



sendGcmPushNotification = function (msg, registrationIds, type, senderName){
    var message = new gcm.Message();
    var sender = new gcm.Sender(config.gcm_apikey);

    message.addData('message', msg);
    message.addData('title', 'Chalk');
    //message.addData('msgcnt', msgcnt);
    message.addData('type', type);
    message.addData('username', senderName);
    message.timeToLive = 3000;
    //message.delayWhileIdle = true;
    sender.send(message, registrationIds, 4, function (result) {
       console.log(result); //null is actually success
       return result;
    });

}

sendSilentGcmSync = function(registrationIds){
    var message = new gcm.Message();
    var sender = new gcm.Sender(config.gcm_apikey);

    message.addData('type', 4);
    message.timeToLive = 3000;
    message.delayWhileIdle = true;


    sender.send(message, registrationIds, 4, function (result) {
        console.log(result); //null is actually success
        return result;
    });
}


module.exports = {
    sendGcmPushNotification: sendGcmPushNotification,
    sendSilentGcmSync: sendSilentGcmSync
};