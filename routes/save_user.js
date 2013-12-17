
var db     = require('../modules/db_helpers.js');
var mailer = require('../modules/mail_helpers.js');


// POST /save_user
//
module.exports = function(req, res) {
  var sender = req.param('sender');
  var title  = req.param('title');

  if (!mailer.validateEmail(sender)) {
    throw sender + ' is not a valid email address';
  }

  var users = db.getDb().collection('users');
  var userCursor = users.find({e: sender}, {limit: 1});
  userCursor.toArray(function(err, docs) {
    var user = docs[0];
    if (user) {
      res.json(user);
      if (!user.c) {
        mailer.sendConfirmationEmail(user);
      }
    } else {
      users.insert({e: sender, c: false}, {safe: true, w: 1}, function(err, docs) {
        var user = docs[0];
        res.json(user);
        mailer.sendConfirmationEmail(user);
      });
    }
  });

};
