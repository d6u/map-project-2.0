
var db       = require('../modules/db_helpers.js');
var ObjectID = require('mongodb').ObjectID;
var mailer   = require('../modules/mail_helpers.js');


// GET /confirm/:user_id
//
module.exports = function(req, res) {

  var _id = req.params.user_id;

  if (_id.length != 24) {
    res.send(404, 'Sorry, this url doesn\'t belongs to anything.');
  } else {
    var users = db.getDb().collection('users');

    users.findAndModify(
      {_id: new ObjectID(_id), c: false},
      '_id',
      {$set: {c: true}},
      {'new': true},
      function(err, user) {
        if (user) {

          var lists = db.getDb().collection('lists');
          var listCursor = lists.find({owner_id: _id});

          listCursor.each(function(err, doc) {
            if (err) throw err;
            if (doc) {
              mailer.sendListEmails(user.e, doc, [user.e], {resend: false});
            }
          });

          res.send('Thanks for your confirmation, go to <a href="/">homepage</a>?');
        } else {
          res.send(404, 'Sorry, this url doesn\'t belongs to anything.');
        }
      }
    );

  }

};
