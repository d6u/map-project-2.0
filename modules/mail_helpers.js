
var mailer = require('nodemailer');
var smtp   = mailer.createTransport('SMTP', {
  host: 'smtp.mandrillapp.com',
  port: 587,
  auth: {user: 'daiweilu123@gmail.com', pass: 'OagEkr3y1Kj6sakFKLRL-Q'}
});


var hostname;
if (process.env.NODE_ENV == 'production') {
  hostname = "http://iwantmap.com/";
} else {
  hostname = "http://localhost:3000/";
}


module.exports = {
  getMailer: function() { return mailer; },

  validateEmail: function(email) {
    var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
  },

  sendConfirmationEmail: function(user) {
    var confirmLink = hostname + "confirm/" + user._id;

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
  sendListEmails: function(sender, list, resend) {
    var listUrl = hostname + list._id;
    var options = {
      from:    sender.e,
      // 'to' field is defined later
      subject: list.t,
      text:    sender.e + " just shared a places list with you, check it out: " + listUrl
    };
    for (var i = list.rs.length - 1; i >= 0; i--) {
      if (!list.rs[i].s || resend) {
        options.to = list.rs[i].e;
        (function(receiver) {
          smtp.sendMail(options, function(err, res) {
            if (err) console.warn(err);
            else console.log("Message sent to " + receiver + ": " + res.message);
          });
        })(options.to);
      }
    }
  }

};
