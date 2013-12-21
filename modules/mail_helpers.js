"use strict";


var path           = require('path')
  , templatesDir   = path.resolve(__dirname, '..', 'email_templates')
  , emailTemplates = require('email-templates')
  , nodemailer     = require('nodemailer')
  , EE             = new (require('events').EventEmitter);


var hostname
  , transport
  , template
  , EMAIL_REGEX = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;


if (process.env.NODE_ENV === 'production') {
  hostname = "http://iwantmap.com/";
} else {
  hostname = "http://localhost:3000/";
}


emailTemplates(templatesDir, function(err, _template) {
  if (err) {
    console.log(err);
  } else {
    template  = _template;
    transport = nodemailer.createTransport('SMTP', {
      host: 'smtp.mandrillapp.com',
      port: 587,
      auth: {user: 'daiweilu123@gmail.com', pass: 'OagEkr3y1Kj6sakFKLRL-Q'}
    });
    EE.emit('transportReady');
  }
});


function getTransport(callback) {
  if (typeof transport === 'undefined') {
    EE.on('transportReady', function() {
      callback(transport);
    });
  } else {
    callback(transport);
  }
}


// Module
//
module.exports = {

  // user: (user Object)
  //
  sendConfirmationEmail: function(user) {
    getTransport(function(transport) {
      var email  = user.e
        , locals = {confirm_link: hostname + "confirm/" + user._id};

      template('confirmation', locals, function(err, html, text) {
        if (err) {
          console.log(err);
        } else {
          transport.sendMail({
            from:    'iwantmap.com <no-reply@iwantmap.com>',
            to:      email,
            subject: 'Confirm email address',
            html:    html,
            text:    text
          }, function(err, status) {
            if (err) {
              console.log(err);
            } else {
              console.log('Confirmation email to "'+email+'" sent: '+status.message);
            }
          });
        }
      });
    });
  },


  validateEmail: function(email) {
    return EMAIL_REGEX.test(email);
  }


};
