
var db       = require('../modules/db_helpers.js');
var ObjectID = require('mongodb').ObjectID;
var mailer   = require('../modules/mail_helpers.js');


// POST /save_list
// POST /:list_id
//
module.exports = function(req, res) {

  var _id = req.params.list_id;

  if (_id) {
    if (_id.length === 24) {
      var list  = req.param('data');
      var lists = db.getDb().collection('lists');
      lists.findOne({_id: new ObjectID(_id)}, function(err, doc) {
        if (doc) {
          list.owner_id = doc.owner_id;
          lists.update({_id: new ObjectID(_id)}, list, {safe: true, w: 1}, function(err, list) {
            res.send(200);
          });
        } else {
          res.send(404, {error: 'invalid id'});
        }
      });
    } else {
      res.send(404, {error: 'invalid id'});
    }
  } else {
    var list  = req.param('data');
    var lists = db.getDb().collection('lists');
    lists.insert(list, {safe: true, w: 1}, function(err, docs) {
      var list = docs[0];
      res.json(list);
    });
  }

};
