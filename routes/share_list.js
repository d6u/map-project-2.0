
var db     = require('../modules/db_helpers.js');
var mailer = require('../modules/mail_helpers.js');


// /share_list
//
module.exports = function(req, res) {
  var form      = req.param('form');
  var sender    = form.sender;
  var title     = form.title;
  var receivers = form.receivers.split(/,\s*/);

  var listId    = req.params.list_id;
  var places    = req.param('places');

  // validate email
  for (var i = receivers.length - 1; i >= 0; i--) {
    if (!mailer.validateEmail(receivers[i])) {
      throw receivers[i] + ' is not a valid email address';
    }
  }

  db.upsertUser(sender, function(user) {
    db.upsertList(
      listId,
      {
        t:  title,
        u:  user._id,
        rs: receivers.map(function(r) { return {e: r, s: false}; }),
        ps: places
      },
      function(list) {
        if (user.c) {
          mailer.sendListEmails(user, list);
        } else {
          mailer.sendConfirmationEmail(user);
        }
        res.json(list);
      }
    );
  });
};
