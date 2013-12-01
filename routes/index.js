
var db = require('../modules/db_helpers.js');


// /:list_id
//
module.exports = function(req, res) {
  db.getList(req.params.list_id, function(list) {
    if (list) {
      res.sendfile('./public/index.html');
    } else {
      res.send(404, 'Sorry, we cannot find anything!');
    }
  });
};
