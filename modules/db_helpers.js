
var MongoClient = require('mongodb').MongoClient;
var ObjectID    = require('mongodb').ObjectID;
var db, lists, users;


MongoClient.connect(
  'mongodb://127.0.0.1:27017/iwantmap',
  function(err, database) {
    if(err) throw err;
    db    = database;
    users = db.collection('users');
    lists = db.collection('lists');
  }
);


module.exports = {
  getDb:      function() { return db; },

  // email:    string
  // callback: called with user as argument
  upsertUser: function(email, callback) {
    users.findOne({e: email}, function(err, user) {
      if (user) callback(user);
      else {
        users.insert(
          {e: email, c: false}, {w: 1, safe: true},
          function(err, user) { callback(user[0]); }
        );
      }
    });
  },

  // query:    id string or query hash
  // callback: called with user as argument
  getUser: function(query, callback) {
    var queryObj = {};
    if (typeof query === 'string') {
      queryObj._id = new ObjectID(query);
    } else {
      queryObj = query;
    }
    users.findOne(query, function(err, user) { callback(user); });
  },

  // callback: called with user as argument
  confirmUserEmail: function(id, callback) {
    users.findAndModify(
      {_id: new ObjectID(id), c: false}, '_id', {$set: {c: true}},
      {w: 1, safe: true, 'new': true},
      function(err, user) { callback(user); }
    );
  },

  getUserLists: function(user, callback) {
    return lists.find({u: user._id}).toArray(callback);
  },

  // id:       can be undefined
  // listData: list object without id
  // callback: called with list as argument
  upsertList: function(id, listData, callback) {
    if (id) {
      lists.update(
        {_id: new ObjectID(id)}, {$set: listData}, {w: 1, safe: true},
        function(err, list) { callback(list); }
      );
    } else {
      lists.insert(
        listData, {w: 1, safe: true},
        function(err, list) { callback(list[0]); }
      );
    }
  }

};
