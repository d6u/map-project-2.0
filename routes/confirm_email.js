
var db       = require('../modules/db_helpers.js');
var ObjectID = require('mongodb').ObjectID;


// GET /confirm/:user_id
//
module.exports = function(req, res) {

  var _id = req.params.user_id;

  if (_id.length != 24) {
    res.send(404, 'Sorry, this url doesn\'t belongs to anything.');
  } else {
    var users = db.getDb().collection('users');
    users.findOne({_id: new ObjectID(_id), c: false}, function(err, user) {
      if (user) {

        users.update(
          {_id: new ObjectID(_id)},
          {$set: {c: true}},
          {w: 1, safe: true},
          function(err, user) {
            res.send('Thanks for your confirmation, go to <a href="/">homepage</a>?');
          }
        );

      } else {
        res.send(404, 'Sorry, this url doesn\'t belongs to anything.');
      }
    });
  }

};
