
var MongoClient = require('mongodb').MongoClient;
var ObjectID    = require('mongodb').ObjectID;
var mailer      = require('nodemailer');
var db;


MongoClient.connect('mongodb://127.0.0.1:27017/iwantmap', function(err, database) {
  if(err) throw err;
  db = database;
});


var smtp = mailer.createTransport('SMTP', {
  host: 'smtp.mandrillapp.com',
  port: 587,
  auth: {user: 'daiweilu123@gmail.com', pass: 'OagEkr3y1Kj6sakFKLRL-Q'}
});


// /confirm/:user_id
//
module.exports = function(req, res) {
  var users = db.collection('users');
  users.findOne({_id: new ObjectID(req.params.user_id)}, function(err, user) {
    if (err) throw err;
    if (!user) throw 'no user found';
    console.log(user);
    users.update({_id: user._id}, {c: true}, function() {
      if (err) throw err;
      res.sendfile('./views/confirm.html');
      sendListsToFriends(user);
    }, {insert: false});
  });
};


function sendListsToFriends(user) {
  var lists = db.collection('lists');
  lists.find({u: user._id}, function(err, lists) {
    if (err) throw err;
    lists.each(function(err, list) {
      if (err) throw err;
      if (list) {
        for (var j = list.rs.length - 1; j >= 0; j--) {
          if (!list.rs[j].s) {
            sendListEmail(user.e, list.rs[j].e, list);
          }
        }
      }
    });
  });
}


function sendListEmail(sender, receiver, list) {
  var options = {
    from:    "iwantmap.com <no-reply@iwantmap.com>",
    to:      receiver,
    subject: list.t,
    text:    sender + " shared a list with you"
  };
  smtp.sendMail(options, function(err, res) {
    if (err) {
      console.log(err);
    } else {
      console.log("Message sent to: " + receiver + " " + res.message);
    }
  });
}
