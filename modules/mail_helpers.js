
var mailer = require('nodemailer');
var smtp   = mailer.createTransport('SMTP', {
  host: 'smtp.mandrillapp.com',
  port: 587,
  auth: {user: 'daiweilu123@gmail.com', pass: 'OagEkr3y1Kj6sakFKLRL-Q'}
});


module.exports = {
  getMailer: function() { return mailer; },

  validateEmail: function(email) {
    var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
  },

  sendConfirmationEmail: function(user) {
    var confirmLink = "http://localhost:3000/confirm/" + user._id;

    var options = {
      from:    "iwantmap.com <no-reply@iwantmap.com>",
      to:      user.e,
      subject: "Confirm email address",
      text:    "Welcome to iwantmap.com, click the link below to confirm your email address.\n" + confirmLink
    };

    smtp.sendMail(options, function(err, res){
      if (err) {
        console.warn(err);
      } else {
        console.log("Message sent to " + user.e + ": " + res.message);
      }
    });
  },

  // sender is a user db object
  // list is a db object
  sendListEmails: function(sender, list) {
    var options = {
      from:    sender.e,
      // 'to' field is defined later
      subject: list.t,
      text:    JSON.stringify(list)
    };
    for (var i = list.rs.length - 1; i >= 0; i--) {
      options.to = list.rs[i].e;
      smtp.sendMail(options, function(err, res) {
        if (err) console.warn(err);
        else console.log("Message sent to " + options.to + ": " + res.message);
      });
    }
  }

};
