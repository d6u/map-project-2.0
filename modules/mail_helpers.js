"use strict";


var path           = require('path')
  , templatesDir   = path.resolve(__dirname, '..', 'email_templates')
  , emailTemplates = require('email-templates')
  , nodemailer     = require('nodemailer')
  , EE             = new (require('events').EventEmitter)
  , _              = require('lodash');


var hostname
  , transport
  , template
  , EMAIL_REGEX = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;


if (process.env.NODE_ENV === 'production') {
  hostname = "http://iwantmap.com/";
} else {
  hostname = "http://localhost:3000/";
}


emailTemplates(templatesDir, function(err, _template) {
  if (err) {
    console.log(err);
  } else {
    template  = _template;
    transport = nodemailer.createTransport('SMTP', {
      host: 'smtp.mandrillapp.com',
      port: 587,
      auth: {user: 'daiweilu123@gmail.com', pass: 'OagEkr3y1Kj6sakFKLRL-Q'}
    });
    EE.emit('transportReady');
  }
});


function getTransport(callback) {
  if (typeof transport === 'undefined') {
    EE.on('transportReady', function() {
      callback(transport);
    });
  } else {
    callback(transport);
  }
}


function generateDirectionLink(startCoord, destCoord) {
  return "http://maps.google.com/?saddr="+startCoord+"&daddr="+destCoord+
         "&directionsmode=driving";
}


function parseList(list) {
  var locals = {id: list._id.toHexString(), name: list.name, places: list.places};
  var routes = [];

  if (list.places.length > 1) {
    switch (list.mode) {
      case 'linear':
        routes[0] = [];
        for (var i = 0; i < list.places.length - 1; i++) {
          var st = list.places[i]
            , ed = list.places[i+1];
          var link = generateDirectionLink(st.location, ed.location);
          routes[0].push({start: st, link: link});
        }
        routes[0].push({start: ed});
        break;
      case 'sunburst':
        var st = list.places[0];
        for (var i = 1; i < list.places.length; i++) {
          var ed = list.places[i];
          var link = generateDirectionLink(st.location, ed.location);
          routes.push([
            {start: st, link: link},
            {start: ed}
          ]);
        }
        break;
      case 'sunburst-reverse':
        var ed = list.places[list.places.length - 1];
        for (var i = 0; i < list.places.length - 1; i++) {
          var st = list.places[i];
          var link = generateDirectionLink(st.location, ed.location);
          routes.push([
            {start: st, link: link},
            {start: ed}
          ]);
        }
        break;
      case 'customized':
        for (var i = 0; i < list.routes.length; i++) {
          routes[i] = [];

          var places = _.map(list.routes[i], function(id) {
            return _.find(list.places, {id: id});
          });

          for (var j = 0; j < places.length - 1; j++) {
            var st = places[j]
              , ed = places[j+1];
            var link = generateDirectionLink(st.location, ed.location);
            routes[i].push({start: st, link: link});
          }

          routes[i].push({start: ed});
        }
        break;
      case 'none': break;
    }
  }

  locals.routes = routes;
  return locals;
}


var Render = function(receiverEmail, locals, listName) {
  this.locals = locals;
  this.send = function(err, html, text) {
    if (err) {
      console.log(err);
    } else {
      transport.sendMail({
        from:    'iwantmap.com <no-reply@iwantmap.com>',
        to:      receiverEmail,
        subject: listName,
        html:    html
        // text:    text
      }, function(err, status) {
        if (err) {
          console.log(err);
        } else {
          console.log(status.message);
        }
      });
    }
  };
  this.batch = function(batch) {
    batch(this.locals, templatesDir, this.send);
  };
};


// Module
//
module.exports = {

  // user: (user Object)
  //
  sendConfirmationEmail: function(user) {
    getTransport(function(transport) {
      var email  = user.e
        , locals = {confirm_link: hostname + "confirm/" + user._id};

      template('confirmation', locals, function(err, html, text) {
        if (err) {
          console.log(err);
        } else {
          transport.sendMail({
            from:    'iwantmap.com <no-reply@iwantmap.com>',
            to:      email,
            subject: 'Confirm email address',
            html:    html,
            text:    text
          }, function(err, status) {
            if (err) {
              console.log(err);
            } else {
              console.log('Confirmation email to "'+email+'" sent: '+status.message);
            }
          });
        }
      });
    });
  },


  // senderEmail: (email String)
  // list       : (list Object)
  // receivers  : (receivers' email Array)
  // options    : (Object: {})
  //    resend: (Boolean: false) if true, will to user that is already received email
  //
  sendListEmails: function(senderEmail, list, receivers, options) {
    options = options || {};
    getTransport(function(transport) {

      var locals = parseList(list);
      locals.senderEmail = senderEmail;

      // Load the template and send the emails
      template('share_list', true, function(err, batch) {
        for(var receiver in receivers) {
          var render = new Render(receivers[receiver], locals, list.name);
          render.batch(batch);
        }
      });

    });
  },


  validateEmail: function(email) {
    return EMAIL_REGEX.test(email);
  }


};
