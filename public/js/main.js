function log() {
  console.log.apply(console, arguments);
}

// --- mapApp ---
//
var app = angular.module('mapApp', ['ngBackbone', 'ngAnimate', 'ngBootstrap']);

app.config(function($locationProvider) {
  $locationProvider.html5Mode(true);
});

app.run(function($location, SavedPlaces) {
  var path = $location.path();
  if (path === '/') {
    SavedPlaces.initEmpty();
  } else {
    var id = /^\/(.+)$/.exec(path)[1];
    SavedPlaces.fetchProject(id);
  }
});


// --- Controllers ---
//
app.controller('AppCtrl', function($scope, SearchedPlaces) {
  this.showDropzone = false;

  var lastTerm;
  $scope.$on('newSearchTerm', function(e, term, inputModel) {
    if (term != lastTerm) {
      lastTerm = term;
      SearchedPlaces.searchWith(term)['finally'](function() {
        inputModel._loading = false;
      });
    }
  });
});


app.controller('MapCtrl', function(Map) {
  this.zoomIn  = function() { Map.zoomIn(); };
  this.zoomOut = function() { Map.zoomOut(); };
});


app.controller('SideCtrl', function($scope, SavedPlaces) {
  var _this = this;
  this.places = SavedPlaces.places;
});


app.controller('InfoCtrl', function($scope, SearchedPlaces) {
  var _this = this;
  $scope.$watch(
    function()       { return SearchedPlaces.models; },
    function(models) { _this.places = models; }
  );
});


// --- Directives ---
//
app.directive('mdMapCanvas', function(Map) {
  return function(scope, element) { Map.init(element[0]); };
});


app.directive('mdSearchResult', function(Map, SearchedPlaces, SavedPlaces) {
  return {
    templateUrl: 'place-template',
    link: function(scope, element, attrs) {
      element.on('mouseenter', function(e) {
        Map.showMouseoverInfoWindow(scope.place._marker, scope.place.get('name'));
      });

      element.on('mouseleave', function() {
        Map.closeMouseoverInfoWindow();
      })

      element.on('click', function(e) {
        if (!/md-place-url/.test(e.target.className)) {
          var place = scope.place;
          scope.$apply(function() {
            SearchedPlaces.remove(place);
            SavedPlaces.add(place);
          });
        }
      });
    }
  }
});


app.directive('mdPlace', function($compile, $templateCache) {
  return function(scope, element, attrs) {
    element.html($compile($templateCache.get( scope.place._input ?
                                             'place-template-inputbox' :
                                             'place-template' ))(scope) );

  };
});


app.directive('mdPlaceInput', function() {
  return function(scope, element, attrs) {
    var textarea = element.children('.md-place-input-textarea');
    var shadow   = element.children('.md-place-input-shadow');
    // var hint     = element.children('.md-place-input-hint');

    function getShadowHeight(string) {
      string  = string.replace(/\n/g, '<br>');
      string  = string.replace(/ $/, '&nbsp;');
      string += '<br>';
      span    = $('<span>');
      shadow.html(span.html(string));
      return shadow.height();
    }

    function updateDimensions (inputVal) {
      textarea.attr('rows', getShadowHeight(inputVal) / 24);
    }

    var timer;
    function emitSearchEvent(val) {
      clearTimeout(timer);
      if (val) {
        scope.$apply(function() { scope.place._loading = true; })
        timer = setTimeout(function() {
          scope.$emit('newSearchTerm', val, scope.place);
        }, 1000);
      } else {
        scope.$apply(function() { scope.place._loading = false; })
      }
    }

    element.on('keydown', function(e) {
      switch (e.keyCode) {
        case 8: updateDimensions(textarea.val().replace(/[\s\S]$/, '')); break;
        case 9: e.preventDefault(); break;
      }
    });

    element.on('keypress', function(e) {
      var char   = e.keyCode === 13 ? "\n" : String.fromCharCode(e.keyCode);
      var string = textarea.val() + char;
      updateDimensions(string);
    });

    element.on('keyup', function(e) {
      var val = textarea.val();
      updateDimensions(val);
      emitSearchEvent(val.replace(/[\s]+$/, ''));
    });
  };
});


app.directive('mdSortablePlaces', function(SavedPlaces) {
  return function(scope, element, attrs) {
    var contents;
    element.sortable({
      appendTo:    '.ly-app',
      cursor:      'move',
      helper:      'clone',
      placeholder: 'md-place-item md-place-item-sort-placeholder',
      start: function(event, ui) {
        if (!ui.item.scope().place._input) {
          scope.$apply(function() { scope.AppCtrl.showDropzone = true; });
        }
        contents = element.contents();
        var placeholder = element.sortable('option', 'placeholder');
        if (placeholder && placeholder.element) {
          contents = contents.not(element.find(
            "." + placeholder.element().attr('class').split(/\s+/).join('.')
          ));
        }
        ui.item._sortable = {initIndex: ui.item.index()};
        ui.placeholder.css('height', ui.item.height());
      },
      update: function(event, ui) {
        if (!scope.AppCtrl.droppedItemIndex) {
          ui.item._sortable.endIndex = ui.item.index();
        }
      },
      stop: function(event, ui) {
        element.sortable('cancel');
        contents.detach().appendTo(element);
        scope.$apply(function() {
          if (scope.AppCtrl.droppedItemIndex) {
            SavedPlaces.places.splice(scope.AppCtrl.droppedItemIndex, 1);
            delete scope.AppCtrl.droppedItemIndex;
          } else if ('endIndex' in ui.item._sortable) {
            var place = SavedPlaces.places.splice(ui.item._sortable.initIndex, 1)[0];
            SavedPlaces.places.splice(ui.item._sortable.endIndex, 0, place);
          }
          scope.AppCtrl.showDropzone = false;
        });
      }
    });

    scope.$watch(
      function() { return SavedPlaces.places.length },
      function() { element.sortable('refresh'); }
    );
  }
})


app.directive('mdDropZone', function($timeout) {
  return {
    link: function(scope, element, attrs) {
      element.droppable({
        accept:     '[md-place]',
        hoverClass: 'md-drop-zone-hover',
        drop: function(event, ui) {
          scope.AppCtrl.droppedItemIndex = ui.draggable.index();
        }
      });
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
          if (path)  match = /^\/(\w+)$/.exec(path);
          if (match) url  += '/' + match[1];

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

  var defaultMapOptions = {
    center:           new google.maps.LatLng(40.77, -73.98),
    zoom:             10,
    disableDefaultUI: true,
    mapTypeId:        google.maps.MapTypeId.ROADMAP,
    styles:           mapStyles
  };

  var Map = {
    init: function(element) {
      this.setMap(new google.maps.Map(element, defaultMapOptions));
      this.enter('ready');
    },
    setMap:    function(map)    { this._googleMap = map; },
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
  _.extend(Map, BackboneEvents);

  return Map;
});


app.value('DirectionsService', new google.maps.DirectionsService);


app.value('PlacesAutocompleteService', new google.maps.places.AutocompleteService);


app.factory('PlacesService', function(Map) {
  var service = {
    textSearch: function(request, callback) {
      var defaults = {};
      if (!request.bounds) defaults.bounds = Map.getBounds();
      request = _.extend(defaults, request);
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


app.factory('Place', function(Backbone, PlacesService, $rootScope, Map) {
  return Backbone.Model.extend({
    initialize: function(attrs, options) {
      var _this = this;
      if (options && options.input) {
        this._input = true;
      } else {
        PlacesService.getDetails(
          {reference: attrs.reference},
          function(result, status) {
            if (status === google.maps.places.PlacesServiceStatus.OK) {
              $rootScope.$apply(function() {
                _this.set(result);
                _this.parseShortAddress();
                _this.getCoverPhoto();
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


app.factory('SearchedPlaces', function(Backbone, Place, Map, PlacesService, $q) {
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
    },
    searchWith: function(term) {
      var deferred = $q.defer();
      var _this = this;
      PlacesService.textSearch({query: term}, function(result, status) {
        if (status === google.maps.places.PlacesServiceStatus.OK) {
          _this.reset();
          _this.add(result.splice(0, 5));
          deferred.resolve();
        } else {
          deferred.reject();
        }
      });
      return deferred.promise;
    }
  });

  return new SearchedPlaces;
});


app.factory('Route', function(Backbone, Place, DirectionsRenderer, Map, $location, $http, PlacesService, $q) {
  var Route = Backbone.Collection.extend({
    model: Place,
    initialize: function() {}
  });

  return Route;
});


app.factory('SavedPlaces', function(Route, Place) {
  var SavedPlaces = {
    places: [],
    initEmpty: function() {
      var place = new Place(null, {input: true});
      this.places.push(place);
    },
    add: function(place) {
      this.places.push(place);
    }
  };

  return SavedPlaces;
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
