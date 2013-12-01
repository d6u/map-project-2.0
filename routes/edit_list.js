
var db     = require('../modules/db_helpers.js');


// POST /:list_id
//
module.exports = function(req, res) {
  db.upsertList(
    req.params.list_id, {ps: req.param('places')},
    function(list) {
      if (list) res.json(list);
    }
  );
};
