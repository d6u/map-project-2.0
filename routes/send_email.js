"use strict";


var db       = require('../modules/db_helpers.js');
var ObjectID = require('mongodb').ObjectID;
var mailer   = require('../modules/mail_helpers.js');


// POST /send_email?self_only=true
//
module.exports = function(req, res) {

  var _id = req.param('list_id');
  if (_id.length === 24) {
    var lists = db.getDb().collection('lists');
    lists.findOne({_id: new ObjectID(_id)}, function(err, list) {
      if (list) {

        var sender = req.param('sender');
        if (req.param('self_only')) {
          mailer.sendListEmails(sender, list, [sender], {resend: false});
        } else {
          mailer.sendListEmails(sender, list, req.param('receivers'), {resend: false});
        }

        res.send(200);
      } else {
        res.send(404, {error: 'invalid list_id'});
      }
    });
  } else {
    res.send(404, {error: 'invalid list_id'});
  }

};
