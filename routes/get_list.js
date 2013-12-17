
var db       = require('../modules/db_helpers.js');
var ObjectID = require('mongodb').ObjectID;


// GET /:list_id/data
//
module.exports = function(req, res) {

  var _id = req.params.list_id;
  if (_id.length === 24) {

    var lists = db.getDb().collection('lists');
    lists.findOne({_id: new ObjectID(_id)}, function(err, list) {
      if (list) {
        res.json(list);
      } else {
        res.send(404, {error: 'invalid id'});
      }
    });

  } else {
    res.send(404, {error: 'invalid id'});
  }

};
