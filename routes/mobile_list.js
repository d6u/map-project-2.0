'use strict';


var db       = require('../modules/db_helpers.js');
var ObjectID = require('mongodb').ObjectID;
var _        = require('lodash');


// GET /mobile/:list_id
//
module.exports = function(req, res) {

  var _id = req.params.list_id;

  if (_id.length != 24) {
    res.send(404, 'Sorry, this url doesn\'t belongs to anything.');
  } else {
    var lists = db.getDb().collection('lists');
    lists.findOne({_id: new ObjectID(_id)}, function(err, list) {
      if (list) {

        console.log(convertListToLocals(list));
        res.render('mobile', convertListToLocals(list), function(err, html) {
          if (err)
            console.log(err);
          else
            res.send(html);
        });


      } else {
        res.send(404, 'Sorry, this url doesn\'t belongs to anything.');
      }
    });
  }

};


// Helpers
//
function convertListToLocals(list) {
  var locals = {title: list.name};
  switch (list.mode) {
    case 'none':
      locals.noRoutesPlaces = list.places;
      break;
    case 'linear':
      convertListToLinearRoutes(locals, list);
      break;
    case 'sunburst':
      convertListToSunburstRoutes(locals, list);
      break;
    case 'sunburst-reverse':
      convertListToSunburstRoutes(locals, list, true);
      break;
    case 'customized':
      convertListToCustomRoutes(locals, list);
      break;
  }
  return locals;
}


function convertListToLinearRoutes(locals, list) {
  var routes = [[]];
  var places = list.places;
  for (var i = 0; i < places.length - 1; i++) {
    routes[0].push(places[i]);
    routes[0].push({
      directions: true,
      url: generateDirectionLink(places[i].location, places[i+1].location)
    });
  }
  routes[0].push(places[i]);
  locals.routes = [routes[0], routes[0]];
  return locals;
}


function convertListToSunburstRoutes(locals, list, reverse) {

}


function convertListToCustomRoutes(locals, list) {

}


function generateDirectionLink(startCoord, destCoord) {
  return "http://maps.google.com/?saddr="+startCoord+"&daddr="+destCoord+
         "&directionsmode=driving";
}
