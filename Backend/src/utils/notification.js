// src/utils/notification.js
const notifier = require('node-notifier');
const path = require('path');

function sendNotification(title, message) {
    notifier.notify({
        title,
        message,
        sound: true,
        wait: false
    });
}

module.exports = { sendNotification };
