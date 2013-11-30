
var MongoClient = require('mongodb').MongoClient;
var mailer      = require('nodemailer');
var format      = require('util').format;
var db;


MongoClient.connect('mongodb://127.0.0.1:27017/iwantmap', function(err, database) {
  if(err) throw err;
  db = database;
});


var smtp = mailer.createTransport('SMTP', {
  host: 'smtp.mandrillapp.com',
  port: 587,
  auth: {user: 'daiweilu123@gmail.com', pass: 'OagEkr3y1Kj6sakFKLRL-Q'}
});


// /share_list
//
module.exports = function(req, res) {
  var form      = req.param('form');
  var places    = req.param('places');
  var sender    = form.sender;
  var title     = form.title;
  var receivers = form.receivers.split(/,\s*/);

  // validate email
  for (var i = receivers.length - 1; i >= 0; i--) {
    if (!validateEmail(receivers[i])) {
      throw receivers[i] + ' is not a valid email address';
    }
  }

  var users = db.collection('users');
  var lists = db.collection('lists');

  users.findOne({e: sender}, function(err, user) {
    if (err) throw err;
    if (user) {
      createList(null, user);
      if (user.c) {
        sendListsToFriends(user);
      } else {
        sendConfirmationEmail(user);
      }
    } else {
      users.insert({e: sender, c: false}, createList);
    }
  });


  function createList(err, user) {
    if(err) throw err;
    var receiversData = [];
    for (var i = 0; i < receivers.length; i++) {
      receiversData.push({e: receivers[i], s: false});
    }
    lists.insert(
      {u: user._id, t: title, rs: receiversData, ps: places},
      function(err, list) { res.json({list_id: list._id}); }
    );
  }


  function sendConfirmationEmail(user) {
    var confirmLink = "http://localhost:3000/confirm/"+ user._id;

    var mailOptions = {
      from:    "iwantmap.com <no-reply@iwantmap.com>",
      to:      user.e,
      subject: "Confirm email address",
      text:    "Welcome to iwantmap.com, click the link below to confirm your email address.\n" + confirmLink
    };

    smtp.sendMail(mailOptions, function(error, response){
      if (error) {
        console.log(error);
      } else {
        console.log("Message sent: " + response.message);
      }
    });
  }
};



function validateEmail(email) {
  var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(email);
}


function sendListsToFriends(user) {
  var lists = db.collection('lists');
  lists.find({u: user._id}, function(err, lists) {
    if (err) throw err;
    for (var i = lists.length - 1; i >= 0; i--) {
      for (var j = lists[i].rs.length - 1; j >= 0; j--) {
        if (!lists[i].re[j].s) {
          sendListEmail(user.e, lists[i].rs[j].e, list);
        }
      }
    }
  });
}


function sendListEmail(sender, receiver, list) {
  var options = {
    from:    sender,
    to:      receiver,
    subject: list.t,
    text:    JSON.parse(list)
  };
  smtp.sendMail(options, function(err, res) {
    if (err) {
      console.log(err);
    } else {
      console.log("Message sent to: " + receiver);
    }
  });
}

