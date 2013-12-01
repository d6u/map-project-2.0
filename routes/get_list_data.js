
var db = require('../modules/db_helpers.js');


// GET /:list_id/data
//
module.exports = function(req, res) {
  db.getList(req.params.list_id, function(list) {
    res.json(list);
  });
};
