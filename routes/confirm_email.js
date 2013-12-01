
var db     = require('../modules/db_helpers.js');
var mailer = require('../modules/mail_helpers.js');


// /confirm/:user_id
//
module.exports = function(req, res) {
  db.confirmUserEmail(req.params.user_id, function(user) {
    if (user) {
      db.getUserLists(user, function(err, lists) {
        for (var i = lists.length - 1; i >= 0; i--) {
          mailer.sendListEmails(user, lists[i]);
        }
      });
    }
    res.sendfile('./views/confirm.html');
  });
};
