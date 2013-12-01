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


angular.module('ngBootstrap', [])
// bs-tooltip, bs-tooltip-title, bs-tooltip-placement
.directive('bsTooltip', function() {
  return function(scope, element, attrs) {

    var options = {
      animation: false,
      placement: attrs.bsTooltipPlacement,
      title:     attrs.bsTooltipTitle,
      container: 'body'
    };

    element.tooltip(options);
    element.on('click', function() {
      if (element.hasClass('search-result')) {
        element.tooltip('destroy');
        $('body').children('.tooltip').remove();
      }
    });
    element.on('mousedown', function() {
      if (element.hasClass('md-place-handle')) {
        element.tooltip('destroy');
        $('body').children('.tooltip').remove();
        element.one('mouseup', function() { element.tooltip(options); });
      }
    });
  };
});


// --- mapApp ---
//
var app = angular.module('mapApp', ['ngBackbone', 'ngAnimate', 'ngBootstrap']);

app.config(function($locationProvider) {
  $locationProvider.html5Mode(true);
});

app.run(function($rootScope) {
  // Show landing user guide
  function stepShowSentence(string, callback) {
    var words = string.split('');
    var delay = 150;
    function stepCalls(step) {
      setTimeout(function() {
        callback(words.slice(0, step + 1).join(''));
      }, step * delay);
    }
    setTimeout(function() {
      for (var i = 0; i < words.length; i++) {
        stepCalls(i)
      }
    }, 2000);
  }

  $rootScope.textareaReady = _.once(function() {
    var textarea = $('#md-place-input-textarea');
    stepShowSentence("Type here to add a place", function(string) {
      textarea.attr('placeholder', string);
    });
  });
});


// --- Controllers ---
//
app.controller('AppCtrl', function($scope, SavedPlaces) {
  this.showDirectionModal = false;
  this.showDropzone       = false;
  this.directionMode      = 'none';
  this.showShareModal     = false;

  var _this = this;

  this.showSavedPlaces = function() {
    SavedPlaces.centerAllPlaces();
  };

  $scope.$watch('AppCtrl.directionMode', function(val) {
    _this.showDirectionModal = false;
    SavedPlaces._directionMode = val;
    SavedPlaces.renderDirections();

    switch (val) {
      case 'linear':
        $('ol[md-place-list]').removeClass('sunburst-direction-intro')
          .addClass('linear-direction-intro');
        break;
      case 'sunburst':
        $('ol[md-place-list]').removeClass('linear-direction-intro')
          .addClass('sunburst-direction-intro');
        break;
      default:
        $('ol[md-place-list]').removeClass('linear-direction-intro sunburst-direction-intro');
    }
  });

  $scope.$watch('AppCtrl.showShareModal', function(val) {
    if (val) {
      $('#share-modal-title').attr(
        'placeholder',
        'Trip to ' + SavedPlaces.getLastPlace().get('name'));
    }
  });
});


app.controller('PanelCtrl', function($scope, SavedPlaces, SearchedPlaces, Place) {
  var _this = this;

  $scope.$watch(
    function()       { return SavedPlaces.models;  },
    function(models) { _this.savedPlaces = models; })

  $scope.$watch(
    function()       { return SearchedPlaces.models;  },
    function(models) { _this.searchedPlaces = models; })

  this.savePlace = function(event ,place) {
    if (event.target.tagName != 'a') {
      SearchedPlaces.reset();
      var newPlace = SavedPlaces.find(function(p) { return p._input; });
      newPlace._input = false;
      newPlace.set(place.attributes);
      newPlace.createMarker();
      var placeInput = new Place(null, {_input: true});
      SavedPlaces.add(placeInput);
    }
  };
});


// --- Directives ---
//
app.directive('mdPlaceEntry', function($compile, $templateCache, SavedPlaces) {
  return {
    controller: function($scope, $element) {

    },
    link: function(scope, element, attrs) {
      var name = scope.place._input ? 'place-input-template' : 'saved-place-template';
      var template = $templateCache.get(name);
      element.html( $compile(template)(scope) );
      if (scope.place._input) element.find('textarea').focus();

      // inform user guide that textare is ready
      scope.textareaReady();

      scope.$watch('place._input', function(val) {
        if (!val) {
          var newChild     = $compile($templateCache.get('saved-place-template'))(scope);
          var currentChild = element.children();
          newChild.css({position: 'absolute', top: 0, left: 350});
          element.append(newChild).animate({height: newChild.height()}, 200, function() {
            element.css({height: ''});
          });
          newChild.animate({left: 0}, 200, function() {
            newChild.css({position: ''});
          });
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
      var hintValue;

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

        // if we want to display hint on the same line and wrap it to next line
        // only when current line width is not enough, use:
        //
        // if (hint.width() + textareaEnd.left > element.width() ||
        //     hintHeight / 24 > 1)
        //
        return {
          lineCount: textareaEnd.lineCount + hintHeight / 24,
          hintStartLine: textareaEnd.lineCount + 1,
          left: 0
        };
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
        hintValue = p.description;
        var nextTerm = "Press \"Tab\" to use: <br/>" + p.description;
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
          textarea.val(hintValue);
          hintValue = '';
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
          case 9:
            updateTextareaHeight();
            updateHint();
            break;
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


app.directive('mdPlaceList', function(PlacesService, Map, SearchedPlaces, SavedPlaces) {
  return {
    controllerAs: 'MpPlaceListCtrl',
    controller: function($scope) {
    },
    link: function(scope, element, attrs, Ctrl) {
      // listen to keyup to fetch search results
      element.on('keyup', function(e) {
        var target = $(e.target);
        var query  = target.val();
        var place  = target.scope().place;
        PlacesService.textSearch(
          {bounds: Map.getBounds(), query: query},
          function(result, status) {
            // clean up tooptips that become orphan
            $('body').children('.tooltip').remove();

            if (status === google.maps.places.PlacesServiceStatus.OK) {
              SearchedPlaces.reset();
              SearchedPlaces.add(result.slice(0,3), {placeInput: place});
            }
          }
        );
        if (query) {
          scope.$apply(function() { place._loading = true; });
        } else {
          scope.$apply(function() {
            delete place._loading;
            SearchedPlaces.reset();
          });
        }
        // clean up tooptips that become orphan
        $('body').children('.tooltip').remove();
      });

      // sortable items
      var contents;
      element.sortable({
        appendTo: '.ly-app',
        cursor: 'move',
        helper: 'clone',
        handle: '.md-place-handle',
        opacity: '.6',
        placeholder: 'md-place-sort-placeholder',
        start: function(event, ui) {
          if (!ui.item.scope().place._input) {
            scope.$apply(function() { scope.AppCtrl.showDropzone = true; });
          }
          contents = element.contents();
          var placeholder = element.sortable('option','placeholder');
          if (placeholder && placeholder.element) {
            contents = contents.not(
              element.find(
                "." + placeholder.element()
                                 .attr('class')
                                 .split(/\s+/).join('.')
              ));
          }
          ui.item._sortable = {initIndex: ui.item.index()};
        },
        update: function(event, ui) {
          if (!scope.AppCtrl.droppedItem) {
            ui.item._sortable.endIndex = ui.item.index();
          }
        },
        stop: function(event, ui) {
          element.sortable('cancel');
          contents.detach().appendTo(element);
          if (scope.AppCtrl.droppedItem) {
            scope.$apply(function() {
              SavedPlaces.remove(scope.AppCtrl.droppedItem.scope().place);
            });
            delete scope.AppCtrl.droppedItem;
          } else if ('endIndex' in ui.item._sortable) {
            var place = SavedPlaces.at(ui.item._sortable.initIndex);
            SavedPlaces.remove(place, {silent: true});
            SavedPlaces.add(place, {at: ui.item._sortable.endIndex});
          }
          scope.$apply(function() { scope.AppCtrl.showDropzone = false; });
        }
      });

      scope.$watch('PanelCtrl.savedPlaces.length', function() {
        element.sortable('refresh');
      });
    }
  };
});


app.directive('mdDropZone', function($timeout) {
  return {
    link: function(scope, element, attrs) {
      element.droppable({
        accept: '.js-saved-place',
        hoverClass: 'md-drop-zone-hover',
        drop: function(event, ui) {
          scope.AppCtrl.droppedItem = ui.draggable;
        }
      });
    }
  };
});


app.directive('mdPlaceMouseover', function(Map) {
  return function(scope, element, attrs) {
    element.on('mouseenter', function(e) {
      if (scope.place._marker) {
        Map.showMouseoverInfoWindow(
          scope.place._marker,
          scope.place.get('name'));
      }
    });
    element.on('mouseleave', function(e) {
      Map.closeMouseoverInfoWindow();
    });
  };
});


app.directive('mdMapControl', function() {
  return {
    controllerAs: 'MdMapControlCtrl',
    controller: function(Map) {
      this.zoomIn = function() {
        Map.zoomIn();
      };
      this.zoomOut = function() {
        Map.zoomOut();
      };
    },
    link: function(scope, element, attrs) {

    }
  };
});


app.directive('mdShareModal', function() {
  return {
    controllerAs: 'MdShareModalCtrl',
    controller: function($http, $element, $scope, SavedPlaces, validateEmail, $q, $location) {

      this.form = {};

      this.send = function() {
        if (this.formValidation.$valid) {
          // Validate receivers' email
          var receivers = this.form.receivers.split(/\s*,\s*/);
          for (var i = receivers.length - 1; i >= 0; i--) {
            if (!validateEmail(receivers[i])) {
              alert('"'+ receivers[i] +'" is not a valid email address.');
              return;
            }
          }

          if (this.form.title == null) {
            this.form.title = $element.find('#share-modal-title')
                                      .attr('placeholder');
          }
          var places = SavedPlaces
            .filter(function(place) { return !place._input; })
            .map(function(place, i) {
              return {
                o: i,
                n: place.get('name'),
                a: place.get('formatted_address'),
                r: place.get('reference')
              };
            });

          var path = $location.path();
          var url  = '/share_list';
          if (path) url += '/' + (/^\/(\w+)$/.exec(path)[1]);

          $http.post(url, {form: this.form, places: places})
          .then(function(res) {
            $location.path('/'+res.data._id);
          });

          $scope.AppCtrl.showShareModal = false;
        };
      };
    },
    link: function(scope, element, attrs, Ctrl) {}
  };
});


// --- Services ---
//
app.factory('Map', function(BackboneEvents) {
  var mouseoverInfoWindow = new google.maps.InfoWindow({
    disableAutoPan: true
  });
  var map = {
    setMap: function(map) {
      this._googleMap = map;
      this.enter('ready');
    },
    getMap:    function()       { return this._googleMap; },
    getBounds: function()       { return this.getMap().getBounds(); },
    fitBounds: function(bounds) { this.getMap().fitBounds(bounds); },
    getZoom:   function()       { return this.getMap().getZoom(); },
    setZoom:   function(level)  { return this.getMap().setZoom(level); },
    zoomIn: function() {
      var map = this.getMap();
      map.setZoom(map.getZoom() + 1);
    },
    zoomOut: function() {
      var map = this.getMap();
      map.setZoom(map.getZoom() - 1);
    },
    showMouseoverInfoWindow: function(marker, title) {
      var content = document.createElement('div');
      content.innerHTML = title;
      content.style.lineHeight = '18px';
      mouseoverInfoWindow.setContent(content);
      mouseoverInfoWindow.open(this.getMap(), marker);
    },
    closeMouseoverInfoWindow: function() {
      mouseoverInfoWindow.close();
    }
  };
  _.extend(map, BackboneEvents);
  return map;
});


app.value('DirectionsService', new google.maps.DirectionsService);


app.value('PlacesAutocompleteService', new google.maps.places.AutocompleteService);


app.factory('PlacesService', function(Map) {
  var textSearchTimer;
  var service = {
    textSearch: function(request, callback) {
      if (textSearchTimer) clearTimeout(textSearchTimer);
      if (request.query) {
        var _this = this;
        textSearchTimer = setTimeout(function() {
          _this._placesService.textSearch(request, callback);
        }, 600);
      }
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


app.factory('Place', function(Backbone, PlacesService, $rootScope, Map) {
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
                if (options && options.placeInput) options.placeInput._loading = null;
                _this.set(result);
                _this.parseShortAddress();
                _this.getCoverPhoto();
              });
            } else {
              $rootScope.$apply(function() {
                if (options && options.placeInput) options.placeInput._loading = null;
              });
            }
            if (options && options.afterGetDetail) {
              options.afterGetDetail(_this);
            }
          }
        );
      }
      this.on('remove', function(_this) {
        _this._marker.setMap(null);
      });
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
    },
    createMarker: function() {
      var _this = this;
      this._marker = new google.maps.Marker({
        cursor: 'pointer',
        flat: false,
        icon: '/img/location-icon-saved-place.png',
        position: this.get('geometry').location,
        map: Map.getMap()
      });
      this.trigger('marker_ready');
      // bind mouseover infoWindow
      this._marker.addListener('mouseover', function() {
        Map.showMouseoverInfoWindow(_this._marker, _this.get('name'));
      });
      this._marker.addListener('mouseout', function() {
        Map.closeMouseoverInfoWindow();
      })
    },
    getMarker: function() {
      return this._marker;
    }
  });
});


app.factory('SearchedPlaces', function(Backbone, Place, Map, $timeout) {
  var SearchedPlaces = Backbone.Collection.extend({
    model: Place,
    initialize: function() {
      this.on('add', function(place, options) {
        place._marker = new google.maps.Marker({
          cursor: 'pointer',
          flat: false,
          icon: '/img/location-icon-search-result.png',
          position: place.get('geometry').location,
          map: Map.getMap()
        });
        // bind mouseover infoWindow
        place._marker.addListener('mouseover', function() {
          Map.showMouseoverInfoWindow(place._marker, place.get('name'));
        });
        place._marker.addListener('mouseout', function() {
          Map.closeMouseoverInfoWindow();
        })
      });
      this.on('reset', function(c, options) {
        for (var i = 0; i < options.previousModels.length; i++) {
          options.previousModels[i]._marker.setMap(null);
        };
      });
    }
  });

  return new SearchedPlaces;
});


app.factory('SavedPlaces', function(Backbone, Place, DirectionsRenderer, Map, $location, $http, PlacesService) {
  var SavedPlaces = Backbone.Collection.extend({
    model: Place,
    initialize: function() {
      var _this  = this;

      // Load list data if id is defined in path
      var listId = /^\/(\w+)$/.exec($location.path())[1];
      if (listId) {
        $http.get('/'+listId+'/data').then(function(res) {
          for (var i = 0; i < res.data.ps.length; i++) {
            var place = new Place({
              reference: res.data.ps[i].r
            }, {
              afterGetDetail: function(place) {
                place.createMarker();
                _this.unshift(place);
              }
            });
          }
        });
      }

      var place  = new Place(null, {_input: true});
      this.add(place);
      this.on('marker_ready', this.renderDirections, this);
      this.on('remove', this.renderDirections, this);
      this.on('add', function(place) {
        if (!place._input) _this.renderDirections();
      });

      // Save list if list id is defined
      this.on('remove add', function() {
        if (listId) {
          var places = _this.filter(function(place) {
            return !place._input;
          }).map(function(place, i) {
            return {
              o: i,
              n: place.get('name'),
              a: place.get('formatted_address'),
              r: place.get('reference')
            };
          });
          $http.post('/'+listId, {places: places});
        }
      });
    },
    // _directionMode
    renderDirections: function() {
      var _this = this;
      switch (this._directionMode) {
        case 'linear':
          var linear = this.getLinearModeLatlng();
          if (linear) {
            DirectionsRenderer.renderLinearDirections(linear)
              .then(function() { _this.centerAllPlaces(); });
          } else {
            DirectionsRenderer.clearDirections();
          }
          break;
        case 'sunburst':
          var sunburst = this.getSunburstModeLatlng();
          if (sunburst) {
            DirectionsRenderer.renderSunburstDirections(sunburst)
              .then(function() { _this.centerAllPlaces(); });
          } else {
            DirectionsRenderer.clearDirections();
          }
          break;
        case 'none':
          this.resetMarkers();
          DirectionsRenderer.clearDirections();
          break;
      }
    },
    getSunburstModeLatlng: function() {
      var origin;
      var dests = [];
      this.forEach(function(place, i) {
        if (!place._input) {
          if (!origin) {
            place.getMarker().setIcon('/img/location-icon-start-point.png');
            origin = place.get('geometry').location;
          } else {
            place.getMarker().setIcon('/img/location-icon-saved-place.png');
            dests.push(place.get('geometry').location);
          }
        }
      });
      if (origin && dests.length) return {origin: origin, dests: dests};
    },
    getLinearModeLatlng: function() {
      var home, waypoints = [], dest;
      var begin = 0;
      var end   = this.length - 1;
      for (var i = 0; i < this.models.length; i++) {
        if (!this.models[i]._input) {
          this.models[i].getMarker().setIcon('/img/location-icon-start-point.png');
          home = this.models[i].get('geometry').location;
          begin = i + 1;
          break;
        }
      }
      for (var i = this.models.length - 1; i >= 0; i--) {
        if (!this.models[i]._input) {
          this.models[i].getMarker().setIcon('/img/location-icon-dest.png');
          dest = this.models[i].get('geometry').location;
          end  = i;
          break;
        }
      }
      if (begin < end) {
        var a = this.slice(begin, end);
        for (var i = 0; i < a.length; i++) {
          if (!a[i]._input) {
            a[i].getMarker().setIcon('/img/location-icon-saved-place.png');
            waypoints.push({location: a[i].get('geometry').location, stopover: true});
          }
        }
      }
      if (begin <= end) return {home: home, dest: dest, waypoints: waypoints};
    },
    centerAllPlaces: function() {
      var bounds = new google.maps.LatLngBounds;
      for (var i = 0; i < this.models.length; i++) {
        var marker = this.models[i]._marker;
        if (marker) bounds.extend(marker.getPosition());
      };
      Map.fitBounds(bounds);
      if (Map.getZoom() > 10) Map.setZoom(10);
    },
    resetMarkers: function() {
      for (var i = this.models.length - 1; i >= 0; i--) {
        if (!this.models[i]._input) {
          this.models[i].getMarker().setIcon('/img/location-icon-saved-place.png');
        }
      }
    },
    getLastPlace: function() {
      for (var i = this.models.length - 1; i >= 0; i--) {
        if (!this.models[i]._input) {
          return this.models[i];
        }
      }
    }
  });

  return new SavedPlaces;
});


app.factory('DirectionsRenderer', function(Map, DirectionsService) {
  var renderers    = [];
  var colorCounter = 0;

  function randomColor() {
    var colors = ['1f77b4', 'ff7f0e', '2ca02c', 'd62728', '9467bd',
                  '8c564b', 'e377c2', 'bcbd22', '17becf'];
    var color = colors[colorCounter++];
    if (!color) {
      colorCounter = -1;
      color = colors[colorCounter++];
    }
    return color;
  }

  function createRenderer(route) {
    var color = randomColor()
    var legs  = route.routes[0].legs;

    _.forEach(route.routes[0].legs, function(leg) {
      var steps = leg.steps;
      var paths = [];
      for (var j = 0; j < steps.length; j++) {
        paths = paths.concat(steps[j].path);
      }

      var renderer = new google.maps.Polyline({
        strokeColor:   color,
        strokeWeight:  10,
        strokeOpacity: 0.5,
        path:          paths
      });

      renderer.addListener('mouseover', function() {
        var anchor = new google.maps.MVCObject;
        anchor.set('position', paths[Math.floor(paths.length / 2)]);
        Map.showMouseoverInfoWindow(anchor, leg.duration.text);
      });

      renderer.setMap(Map.getMap());
      renderers.push(renderer);
    });
  }

  function cleanRenders() {
    for (var i = 0; i < renderers.length; i++) {
      renderers[i].setMap(null);
    }
    colorCounter = 0;
    renderers = [];
  }

  var service  = {
    renderLinearDirections: function(linear) {
      var d = new jQuery.Deferred;
      cleanRenders();
      DirectionsService.route({
        origin:      linear.home,
        destination: linear.dest,
        waypoints:   linear.waypoints,
        travelMode:  google.maps.TravelMode.DRIVING
      }, function(result, status) {
        if (status === google.maps.DirectionsStatus.OK) {
          createRenderer(result);
          d.resolve();
        } else {
          d.resolve();
        }
      });
      return d;
    },
    renderSunburstDirections: function(sunburst) {
      var ds = [];
      cleanRenders();
      _.forEach(sunburst.dests, function(dest) {
        var d = new jQuery.Deferred;
        ds.push(d);
        DirectionsService.route({
          origin:      sunburst.origin,
          destination: dest,
          travelMode:  google.maps.TravelMode.DRIVING
        }, function(result, status) {
          if (status === google.maps.DirectionsStatus.OK) {
            createRenderer(result);
            d.resolve();
          } else {
            d.resolve();
          }
        });
      });
      return jQuery.when.apply(jQuery, ds);
    },
    clearDirections: function() {
      cleanRenders();
    }
  };
  return service;
});


app.value('validateEmail', function(email) {
  var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(email);
});
