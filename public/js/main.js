// Avoid `console` errors in browsers that lack a console.
(function() {
  var method;
  var noop = function () {};
  var methods = [
    'assert', 'clear', 'count', 'debug', 'dir', 'dirxml', 'error',
    'exception', 'group', 'groupCollapsed', 'groupEnd', 'info', 'log',
    'markTimeline', 'profile', 'profileEnd', 'table', 'time', 'timeEnd',
    'timeStamp', 'trace', 'warn'
  ];
  var length = methods.length;
  var console = (window.console = window.console || {});

  while (length--) {
    method = methods[length];

    // Only stub undefined methods.
    if (!console[method]) {
      console[method] = noop;
    }
  }
}());


// --- Modules ---
angular.module('ngBackbone', [])
.factory('BackboneEvents', function() {

  function de(current, deVal) {
    return (typeof current === 'undefined') ? deVal : current;
  }

  Backbone.Events._checkStatesProperties = function(state) {
    this._states               = de(this._states              , {});
    this._inStateCalls         = de(this._inStateCalls        , {});
    this._inStateCalls[state]  = de(this._inStateCalls[state] , []);
    this._outStateCalls        = de(this._outStateCalls       , {});
    this._outStateCalls[state] = de(this._outStateCalls[state], []);
  };

  Backbone.Events.inState = function(state, callback, context) {
    this._checkStatesProperties(state);

    var bindCall = _.bind(callback, context || this);
    this._inStateCalls[state].push(bindCall);
    if (this._states[state]) bindCall();
  };

  Backbone.Events.outState = function(state, callback, context) {
    this._checkStatesProperties(state);

    var bindCall = _.bind(callback, context || this);
    this._outStateCalls[state].push(bindCall);
    if (!this._states[state]) bindCall();
  };

  Backbone.Events.enter = function(state) {
    this._checkStatesProperties(state);
    var isc = this._inStateCalls[state];

    if (!this._states[state]) {
      this._states[state] = true;
      for (var i = 0; i < isc.length; i++) { isc[i](); }
    }
  };

  Backbone.Events.leave = function(state) {
    this._checkStatesProperties(state);
    var osc = this._outStateCalls[state];

    if (this._states[state]) {
      this._states[state] = false;
      for (var i = 0; i < osc.length; i++) { osc[i](); }
    }
  };

  return Backbone.Events;
})
.factory('BackboneSync', function() {
  return Backbone;
})
.factory('Backbone', function(BackboneEvents, BackboneSync) {
  return Backbone;
});


// --- mapApp ---
//
var app = angular.module('mapApp', ['ngBackbone', 'ngAnimate']);


// --- Controllers ---
//
app.controller('AppCtrl', function() {
  this.showDirectionModal = false;
});


app.controller('PanelCtrl', function($scope, SavedPlaces, SearchedPlaces, Place) {
  var _this = this;

  this.savedPlaces    = SavedPlaces.models;

  $scope.$watch(
    function()       { return SearchedPlaces.models;  },
    function(models) { _this.searchedPlaces = models; })

  this.savePlace = function(event ,place) {
    if (event.target.tagName != 'a') {
      SearchedPlaces.reset();
      var newPlace = SavedPlaces.last();
      newPlace._input = false;
      newPlace.set(place.attributes);
      var placeInput = new Place(null, {_input: true});
      SavedPlaces.add(placeInput);
    }
  };
});


// --- Directives ---
//
app.directive('mdPlaceEntry', function($compile, $templateCache) {
  return {
    controller: function($scope, $element) {

    },
    link: function(scope, element, attrs) {
      var name = scope.place._input ? 'place-input-template' : 'saved-place-template';
      var template = $templateCache.get(name);
      element.html( $compile(template)(scope) );

      scope.$watch('place._input', function(val) {
        if (!val) {
          var newChild     = $compile($templateCache.get('saved-place-template'))(scope);
          var currentChild = element.children();
          newChild.css({position: 'absolute', top: 0, left: 350});
          element.append(newChild).animate({height: newChild.height()}, 200);
          newChild.animate({left: 0}, 200);
          currentChild.css('opacity', 1).animate({opacity: 0}, 200, function() {
            currentChild.remove();
          });
        }
      });
    }
  };
});


app.directive('mdPlaceInput', function(PlacesAutocompleteService, Map) {
  return {
    link: function(scope, element, attrs) {
      var textarea = element.children('.md-place-input-textarea');
      var shadow   = element.children('.md-place-input-shadow');
      var hint     = element.children('.md-place-input-hint');
      var textareaEnd;

      // return {} with textarea ending position left and lineCount value
      //
      function getTextareaEndingPosition(extra) {
        var contents = extra ? (textarea.val() + extra).split(/\n/)
                             : textarea.val().split(/\n/);
        var span, left;
        var lineCount = 0;

        shadow.empty();
        for (var i = 0; i < contents.length; i++) {
          span = $('<span>');
          span.html(contents[i].replace(/ $/g, '&nbsp;'));
          shadow.append(span, $('<br>'));
          var rects = span[0].getClientRects();
          lineCount += rects.length;
          left = rects.length ? rects[rects.length - 1].width : 0;
        }
        textarea.attr('rows', (shadow.height() / 24) || 1);

        return {
          lineCount: lineCount ? lineCount : 1,
          left: left
        }
      }

      // return {} with hint beginning position left and lineCount value
      //
      function getHintBeginningPosition(textareaEnd, hintValue) {
        hint.html(hintValue);
        var hintHeight = hint.height();
        if (hint.width() + textareaEnd.left > element.width() || hintHeight / 24 > 1) {
          return {
            lineCount: textareaEnd.lineCount + hintHeight / 24,
            hintStartLine: textareaEnd.lineCount + 1,
            left: 0
          };
        } else {
          textareaEnd.hintStartLine = textareaEnd.lineCount;
          return textareaEnd;
        }
      }

      function updateHint(val) {
        if (val) {
          PlacesAutocompleteService.getQueryPredictions(
            {bounds: Map.getBounds(), input: val},
            function(prediction, status) {
              if (status === google.maps.places.PlacesServiceStatus.OK) {
                displayHint(val, prediction[0]);
              } else {
                hint.empty();
              }
            });
        } else {
          hint.empty();
        }
      }

      function displayHint(v, p) {
        var nextTerm = p.description;
        if (nextTerm && nextTerm != textarea.val()) {
          var position = getHintBeginningPosition(textareaEnd, nextTerm);
          textarea.attr('rows', position.lineCount);
          hint.css({
            top: 8 + (position.hintStartLine - 1) * 24,
            left: position.left});
        } else {
          hint.empty();
        }
      }

      function hintAutocomplete() {
        if (hint.html()) {
          textarea.val(hint.html());
          hint.empty();
        }
      }

      function updateTextareaHeight(extra) {
        textareaEnd = getTextareaEndingPosition(extra);
        textarea.attr('rows', textareaEnd.lineCount);
      }

      textarea.on('keydown', function(e) {
        switch (e.keyCode) {
          case 8:
            hint.empty();
            break;
          case 9:
            hintAutocomplete();
            e.preventDefault();
            break;
          case 13:
            updateTextareaHeight("\n");
            break;
          case 37:
          case 38:
          case 39:
          case 40:
            break;
          default:
            updateTextareaHeight(String.fromCharCode(e.keyCode));
        }
      });

      textarea.on('keyup', function(e) {
        switch (e.keyCode) {
          default:
            updateTextareaHeight();
            updateHint(textarea.val());
        }
      });

      textarea.on('paste', function(e) {
        setTimeout(function() {
          updateTextareaHeight();
        });
      });
    }
  };
}); // END of mdPlaceInput


app.directive('mdMapCanvas', function(Map) {
  return {
    link: function(scope, element, attrs) {
      var mapStyles = [
        {
          "featureType": "water",
          "stylers": [{
            "color": "#46bcec"
          }, {
            "visibility": "on"
          }]
        }, {
          "featureType": "landscape",
          "stylers": [{
            "color": "#f2f2f2"
          }]
        }, {
          "featureType": "road",
          "stylers": [{
            "saturation": -100
          }, {
            "lightness": 45
          }]
        }, {
          "featureType": "road.highway",
          "stylers": [{
            "visibility": "simplified"
          }]
        }, {
          "featureType": "road.arterial",
          "elementType": "labels.icon",
          "stylers": [{
            "visibility": "off"
          }]
        }, {
          "featureType": "administrative",
          "elementType": "labels.text.fill",
          "stylers": [{
            "color": "#444444"
          }]
        }, {
          "featureType": "transit",
          "stylers": [{
            "visibility": "off"
          }]
        }, {
          "featureType": "poi",
          "stylers": [{
            "visibility": "off"
          }]
        }
      ];
      Map.setMap(new google.maps.Map(element[0], {
        center:           new google.maps.LatLng(40.77, -73.98),
        zoom:             10,
        disableDefaultUI: true,
        mapTypeId:        google.maps.MapTypeId.ROADMAP,
        styles:           mapStyles
      }));
    }
  };
});


app.directive('mdPlaceList', function(PlacesService, Map, SearchedPlaces) {
  return {
    controllerAs: 'MpPlaceListCtrl',
    controller: function($scope) {
    },
    link: function(scope, element, attrs, Ctrl) {
      element.on('keyup', function(e) {
        var target = $(e.target);
        var query = target.val();
        if (query) {
          var place = target.scope().place;
          scope.$apply(function() { place._loading = true; });
          PlacesService.textSearch(
            {bounds: Map.getBounds(), query: query},
            function(result, status) {
              if (status === google.maps.places.PlacesServiceStatus.OK) {
                SearchedPlaces.reset();
                SearchedPlaces.add(result.slice(0,3), {placeInput: place});
              }
            }
          );
        } else {
          scope.$apply(function() { SearchedPlaces.reset(); });
        }
      });
    }
  };
});


// --- Services ---
//
app.factory('Map', function(BackboneEvents) {
  var map = {
    setMap: function(map) {
      this._googleMap = map;
      this.enter('ready');
    },
    getMap: function() { return this._googleMap; },
    getBounds: function() { return this.getMap().getBounds(); }
  };
  _.extend(map, BackboneEvents);
  return map;
});


app.value('PlacesAutocompleteService', new google.maps.places.AutocompleteService());


app.factory('PlacesService', function(Map) {
  var service = {
    textSearch: function(request, callback) {
      this._placesService.textSearch(request, callback);
    },
    getDetails: function(request, callback) {
      this._placesService.getDetails(request, callback);
    }
  };
  Map.inState('ready', function() {
    service._placesService = new google.maps.places.PlacesService(Map.getMap());
  });
  return service;
});


app.factory('Place', function(Backbone, PlacesService, $rootScope) {
  return Backbone.Model.extend({
    initialize: function(attrs, options) {
      if (options && options._input) {
        this._input = true;
      } else {
        var _this = this;
        PlacesService.getDetails(
          {reference: attrs.reference},
          function(result, status) {
            if (status === google.maps.places.PlacesServiceStatus.OK) {
              $rootScope.$apply(function() {
                if (options.placeInput) options.placeInput._loading = null;
                _this.set(result);
                _this.parseShortAddress();
                _this.getCoverPhoto();
              });
            } else {
              $rootScope.$apply(function() {
                if (options.placeInput) options.placeInput._loading = null;
              });
            }
          }
        );
      }
    },
    parseShortAddress: function() {
      var short_addresses = [];
      var acp = this.get('address_components');
      for (var i = 0; i < acp.length; i++) {
        if (acp[i].types[0] != 'locality') {
          short_addresses.push(acp[i].short_name);
        } else {
          break;
        }
      };
      this.set('short_address', short_addresses.join(', '));
    },
    getCoverPhoto: function() {
      if (this.has('photos')) {
        this.set(
          'cover_picture',
          this.get('photos')[0].getUrl({maxWidth: 80, maxHeight: 80}));
      }
    }
  });
});


app.factory('SearchedPlaces', function(Backbone, Place, PlacesService, $timeout) {
  var SearchedPlaces = Backbone.Collection.extend({
    model: Place,
    initialize: function() {
    }
  });

  return new SearchedPlaces;
});


app.factory('SavedPlaces', function(Backbone, Place) {
  var SavedPlaces = Backbone.Collection.extend({
    model: Place,
    initialize: function() {
      var place = new Place(null, {_input: true});
      this.add(place);
    }
  });

  return new SavedPlaces;
});
