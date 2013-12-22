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
  if (list.places.length > 1) {
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
  locals.routes = routes;
  return locals;
}


function convertListToSunburstRoutes(locals, list, reverse) {
  var routes = [];
  var places = list.places;
  if (!reverse) {
    var home = places[0];
    for (var i = 1; i < places.length; i++) {
      var route = [
        home,
        {
          directions: true,
          url: generateDirectionLink(home.location, places[i].location)
        },
        places[i]
      ];
      routes.push(route);
    }
  } else {
    var dest = places[places.length - 1];
    for (var i = 0; i < places.length - 1; i++) {
      var route = [
        places[i],
        {
          directions: true,
          url: generateDirectionLink(places[i].location, dest.location)
        },
        dest
      ];
      routes.push(route);
    }
  }
  locals.routes = routes;
  return locals;
}


function convertListToCustomRoutes(locals, list) {
  var routes = []
    , places = list.places
    , noRoutesPlaces = places.slice(0)
    , listRoutes = list.routes;

  for (var i = 0; i < listRoutes.length; i++) {
    var route    = []
      , prePlace = _.find(places, {id: listRoutes[i][0]});

    route.push(prePlace);

    for (var j = 1; j < listRoutes[i].length; j++) {
      var place = _.find(places, {id: listRoutes[i][j]});
      route.push({
        directions: true,
        url: generateDirectionLink(prePlace.location, place.location)
      });
      route.push(place);
      prePlace = place;
    }

    routes.push(route);

    noRoutesPlaces = _.without.apply(_, [noRoutesPlaces].concat(route));
  }

  locals.noRoutesPlaces = noRoutesPlaces;
  locals.routes = routes;
  return locals;
}


function generateDirectionLink(startCoord, destCoord) {
  return "http://maps.google.com/?saddr="+startCoord+"&daddr="+destCoord+
         "&directionsmode=driving";
}
