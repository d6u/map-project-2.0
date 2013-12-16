"use strict";


// --- mapApp ---
//
var app = angular.module('mapApp', ['ngBackbone', 'ngAnimate', 'ngBootstrap']);

app.config(function($locationProvider) {
  $locationProvider.html5Mode(true);
});

app.run(function($rootScope, SavedPlaces, SearchedPlaces, Map, UI) {
  $rootScope.SavedPlaces    = SavedPlaces;
  $rootScope.SearchedPlaces = SearchedPlaces;
  $rootScope.Map = Map;
  $rootScope.UI  = UI;

  // md-sortable-places events
  //
  $rootScope.$on('placeRemoved', function(e, index) {
    SavedPlaces.at(index).destory();
  });

  $rootScope.$on('placeListSorted', function(e, sortResult) {
    var place = SavedPlaces.at(sortResult.initIndex);
    SavedPlaces.remove(place, {silent: true});
    SavedPlaces.add(place, {at: sortResult.endIndex, silent: true});
    SavedPlaces.trigger('sort');
  });
});


// --- Directives ---
//
app.directive('mdMapCanvas', function(Map) {
  return function(scope, element) { Map.setCanvas(element[0]); };
});


app.directive('mdSearchResult', function(Map, SearchedPlaces, SavedPlaces) {
  return {
    templateUrl: 'place-template',
    link: function(scope, element, attrs) {
      scope.place._element = element;
      scope.place._scope   = scope;
      scope.place.bindMouseoverInfowindowToElement();

      element.on('mouseenter', function(e) {
        Map.showMouseoverInfoWindow(scope.place._marker, scope.place.get('name'));
      });

      element.on('mouseleave', function() {
        Map.closeMouseoverInfoWindow();
      });

      element.on('click', function(e) {
        if (!/md-place-url/.test(e.target.className)) {
          var place = scope.place;
          scope.$apply(function() {
            SearchedPlaces.remove(place);
            var inputModel = SavedPlaces.find('_input');
            var index = SavedPlaces.indexOf(inputModel);
            SavedPlaces.add(place, {at: index});
            SavedPlaces.resetInput();
          });
        }
      });
    }
  }
});


app.directive('mdPlace', function($compile, $templateCache, Map) {
  return function(scope, element, attrs) {
    element.html($compile($templateCache.get( scope.place._input ?
                                             'place-template-inputbox' :
                                             'place-template' ))(scope) );
    scope.place._element = element;
    scope.place._scope   = scope;
    if (!scope.place._input) scope.place.bindMouseoverInfowindowToElement();
  };
});


app.directive('mdPlaceInput', function(SearchedPlaces) {
  return {
    controllerAs: 'mdPlaceInputCtrl',
    controller: function($scope, $element) {
      var textarea = $element.children('.md-place-input-textarea');
      this.clearInput = function() {
        textarea.val('');
        SearchedPlaces.reset();
        $scope.place._cancelable = false;
        delete this.lastTerm;
      };
    },
    link: function(scope, element, attrs, Ctrl) {
      var textarea = element.children('.md-place-input-textarea');
      var shadow   = element.children('.md-place-input-shadow');
      // var hint     = element.children('.md-place-input-hint');

      function getShadowHeight(string) {
        string  = string.replace(/\n/g, '<br>');
        string  = string.replace(/ $/, '&nbsp;');
        string += '<br>';
        var span = $('<span>');
        shadow.html(span.html(string));
        return shadow.height();
      }

      function updateDimensions (inputVal) {
        textarea.attr('rows', getShadowHeight(inputVal) / 24);
      }

      var timer;
      function initSearch(val) {
        clearTimeout(timer);
        if (val) {
          scope.$apply(function() { scope.place._loading = true; })
          timer = setTimeout(function() { searchPlaces(val); }, 1000);
        } else {
          scope.$apply(function() { scope.place._loading = false; })
        }
      }

      function searchPlaces(term) {
        if (term != Ctrl.lastTerm) {
          Ctrl.lastTerm = term;
          SearchedPlaces.searchWith(term)['finally'](function() {
            scope.place._loading = false;
          });
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
        initSearch(val.replace(/[\s]+$/, ''));
        scope.place._cancelable = !!val || !!SearchedPlaces.length;
      });
    }
  };
});


app.directive('mdSortablePlaces', function(SavedPlaces, UI, $rootScope) {
  return function(scope, element, attrs) {
    var contents;
    element.sortable({
      appendTo:    '.ly-app',
      cursor:      'move',
      helper:      'clone',
      placeholder: 'md-place-item md-place-item-sort-placeholder',
      start: function(event, ui) {
        if (!ui.item.scope().place._input) {
          scope.$apply(function() { UI.showDropzone = true; });
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
        if (typeof $rootScope.droppedItemIndex === 'undefined') {
          ui.item._sortable.endIndex = ui.item.index();
        }
      },
      stop: function(event, ui) {
        element.sortable('cancel');
        contents.detach().appendTo(element);
          if (typeof $rootScope.droppedItemIndex != 'undefined') {
          scope.$emit('placeRemoved', $rootScope.droppedItemIndex);
            delete $rootScope.droppedItemIndex;
          } else if ('endIndex' in ui.item._sortable) {
          scope.$emit('placeListSorted', ui.item._sortable);
          }
        scope.$apply(function() { UI.showDropzone = false; });
      }
    });

    SavedPlaces.on('all', function() {
      element.sortable('refresh');
    });
  }
});


app.directive('mdDropZone', function($timeout, $rootScope) {
  return {
    link: function(scope, element, attrs) {
      element.droppable({
        accept:     '[md-place]',
        hoverClass: 'md-drop-zone-hover',
        drop: function(event, ui) {
          $rootScope.droppedItemIndex = ui.draggable.index();
        }
      });
    }
  };
});


app.directive('mdSaveModal', function($http, UI, $location, SavedPlaces) {
  return {
    controllerAs: 'MdSaveModalCtrl',
    controller: function($scope) {
      // this.form
      this.list = {};

      this.save = function() {
        if (this.form.$valid) {
          if (!this.list.title) this.list.title = 'Untitled list';
          $http.post('/save_user', this.list).success(function(user) {
            SavedPlaces.save(user);
          });
          UI.hideAllModal();
        }
      }
    },
    link: function(scope, element, attrs) {}
  };
});


app.directive('mdShareModal', function($animate, UI) {
  return {
    controllerAs: 'MdShareModalCtrl',
    controller: function($scope) {},
    link: function(scope, element, attrs, Ctrl) {

      function bounceUpAnimation() {
        var child = element.children('.cp-modal-content');
        $animate.addClass(child, 'bounce-up-effect', function() {
          child.css('display', 'none');
          child.removeClass('bounce-up-effect');
          scope.$apply(function() { UI.showShareModal = false; });
          child.css('display', '');
        });
      }

      Ctrl.send = function() {
        bounceUpAnimation();
      };
    }
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
    setCanvas: function(element) {
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
    textSearch: function(query, callback) {
      this._placesService.textSearch(
        {bounds: Map.getBounds(), query: query},
        callback
      );
    },
    getDetails: function(reference, callback) {
      this._placesService.getDetails({reference: reference}, callback);
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
      options = options || {};
      if (options.input) {
        this._input = true;
      } else {
        this.getDetails();
        this.createMarker('/img/location-icon-search-result.png');
      }

      this.on('destory', function() {
        this._marker.setMap(null);
      });
    },
    getDetails: function() {
      var _this = this;
      PlacesService.getDetails(this.get('reference'), function(result, status) {
        if (status === google.maps.places.PlacesServiceStatus.OK) {
          $rootScope.$apply(function() {
            _this.set(result);
            _this.parseShortAddress();
            _this.getCoverPhoto();
          });
        }
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
    createMarker: function(icon) {
      var _this = this;
      this._marker = new google.maps.Marker({
        cursor:  'pointer',
        flat:     false,
        icon:     icon,
        position: this.get('geometry').location,
        map:      Map.getMap()
      });
      this.trigger('marker_ready');
      // bind mouseover infoWindow
      this._marker.addListener('mouseover', function() {
        Map.showMouseoverInfoWindow(this, _this.get('name'));
      });
      this._marker.addListener('mouseout', function() {
        Map.closeMouseoverInfoWindow();
      });
    },
    bindMouseoverInfowindowToElement: function() {
      var _this = this;
      this._element.on('mouseenter', function() {
        Map.showMouseoverInfoWindow(_this.getMarker(), _this.get('name'));
      });
      this._element.on('mouseleave', function() {
        Map.closeMouseoverInfoWindow();
      });
    },
    getMarker: function() {
      return this._marker;
    }
  });
});


app.factory('Route', function(Place, DirectionsRenderer) {
  var Route = Backbone.Collection.extend({
    model: Place,
    initialize: function(places, options) {
      var _this = this;
      var cancelable = options && options.cancelableRoute;

      if (places.length > 1) {
        this._renderer = DirectionsRenderer.renderDirectionsWith(places);
        if (cancelable) this.makeRouteCancelable();
      }

      this.on('reset', function() {
        if (typeof this._renderer != 'undefined') this._renderer.removeDirections();
      });

      this.on('add', function(model) {
        if (typeof this._renderer != 'undefined') this._renderer.removeDirections();
        this._renderer = DirectionsRenderer.renderDirectionsWith(this.models);
        if (cancelable) this.makeRouteCancelable();
      });
    },

    // for Complex routes
    //
    makeRouteCancelable: function() {
      var _this = this;
      this._renderer.on('stabilized', function() {
        var polylines = _this._renderer.getPolylines();
        for (var i = 0; i < polylines.length; i++) {
          google.maps.event.addListenerOnce(polylines[i], 'rightclick', function() {
            // --- TODO ---
            // make the behavior more intelligent
            this.setMap(null);
          });
        }
      })
    }
  });

  return Route;
});


app.factory('SearchedPlaces', function(Backbone, Place, Map, PlacesService, $q) {
  var SearchedPlaces = Backbone.Collection.extend({
    name: 'SearchedPlaces',
    model: Place,
    initialize: function() {
      this.on('reset', function(c, options) {
        for (var i = 0; i < options.previousModels.length; i++) {
          options.previousModels[i]._marker.setMap(null);
        };
      });
    },
    searchWith: function(term) {
      var deferred = $q.defer();
      var _this = this;
      PlacesService.textSearch(term, function(result, status) {
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


app.factory('SavedPlaces', function(Backbone, $location, Route, Place, Map, $rootScope, UI, BackboneEvents, $http) {

  var routes = [];
  var routeEditableListeners = [];

  var SavedPlaces = Backbone.Collection.extend({
    model: Place,
    initialize: function() {
      var path = $location.path();
      if (path === '/') {
        this.addInputModel();
      } else {
        this.fetch(path);
        this.addInputModel();
        this.turnOnAutoSave();
      }

      this.on('add', function(model) {
        model.getMarker().setIcon('/img/location-icon-saved-place.png');
        this.trigger('update');
      });

      this.on('sort', function() { this.trigger('update'); });

      var _this = this;
      this.on('sort add remove reset', this.renderDirections);
      $rootScope.$watch('UI.directionMode', function() {
        _this.renderDirections();
      });

      _.extend(this, BackboneEvents);
      this.inState('complexRoutes', function() {
        _this.resetRoutes();
      });
    },

    // Custom Actions
    //
    addInputModel: function(options) {
      options = typeof options === 'undefined' ? {} : options;
      var place = new Place(null, {input: true});
      this.add(place, {at: options.at != null ? options.at : this.length - 1});
    },
    resetInput: function() {
      this.find('_input')._element.find('textarea').val('').focus();
    },


    // Render Directions
    //
    renderDirections: function() {
      if (UI.directionMode != 'customized') {
        this.leave('complexRoutes');
        this.resetRoutes();
      }
      if (UI.directionMode != 'none') {
        var places = this.select(function(p) { return !p._input; });
      } else {
        this.trigger('update');
      }
      if (typeof places === 'undefined' || places <= 1) return;
      switch (UI.directionMode) {
        case 'linear':
          routes.push(new Route(places));
          places[places.length - 1].getMarker().setIcon('/img/location-icon-dest.png');
          places[0].getMarker().setIcon('/img/location-icon-start-point.png');
          break;
        case 'sunburst':
          var first  = places[0];
          var places = places.slice(1, places.length);
          var pairs  = _.map(places, function(p) { return [first, p]; });
          for (var i = 0; i < pairs.length; i++) {
            routes.push(new Route(pairs[i]));
          }
          first.getMarker().setIcon('/img/location-icon-start-point.png');
          break;
        case 'sunburst-reverse':
          var last   = places[places.length - 1];
          var places = places.slice(0, places.length - 1);
          var pairs  = _.map(places, function(p) { return [p, last]; });
          for (var i = 0; i < pairs.length; i++) {
            routes.push(new Route(pairs[i]));
          }
          last.getMarker().setIcon('/img/location-icon-dest.png');
          break;
        case 'customized':
          this.enter('complexRoutes');
          this.enableRoutesEditor(places);
          break;
      }

      this.trigger('update');
    },

    resetRoutes: function() {
      for (var i = 0; i < routes.length; i++) { routes[i].reset(); }
      routes = [];
      for (var i = 0; i < this.models.length; i++) {
        var m = this.models[i];
        if (!m._input) m.getMarker().setIcon('/img/location-icon-saved-place.png');
      };
      this.cleanUpRoutesEditor();
    },


    // Routes Editor
    //
    enableRoutesEditor: function(places) {
      this.cleanUpRoutesEditor();
      var event = google.maps.event;
      var _this = this;
      _.forEach(places, function(p) {
        p._routeEditable = true;

        // Mousedown
        var markerListener = event.addListener(p.getMarker(), 'mousedown', function(e) {

          var map   = Map.getMap();
          var start = e.latLng;
          var valid = false;

          map.setOptions({draggable: false});

          var polyline = new google.maps.Polyline({
            clickable:     true,
            strokeColor:  'red',
            strokeOpacity: 1,
            strokeWeight:  3,
            map:           map
          });

          var mapMousemoveListener = event.addListener(map, 'mousemove', function(e) {
            var end = e.latLng;
            polyline.setPath([start, end]);
          });

          var markerMouseoverListeners = _.map(places, function(p) {
            return event.addListener(p.getMarker(), 'mouseover', function(e) {
              var end = e.latLng;
              polyline.setPath([start, end]);
            });
          });

          var markerMouseupListeners = _.map(places, function(p) {
            return event.addListenerOnce(p.getMarker(), 'mouseup', function(e) {
              var end = e.latLng;
              if (start != end) {
                valid = true;
                _this.addComplexRoute(start, end);
              }
              cleanUp();
            });
          });

          var domMouseupListener = event.addDomListenerOnce(document, 'mouseup', function(e) {
            cleanUp();
          });

          function cleanUp() {
            polyline.setMap(null);
            map.setOptions({draggable: true});
            event.removeListener(mapMousemoveListener);
            for (var i = 0; i < markerMouseoverListeners.length; i++) {
              event.removeListener(markerMouseoverListeners[i]);
            }
            for (var i = 0; i < markerMouseupListeners.length; i++) {
              event.removeListener(markerMouseupListeners[i]);
            }
            event.removeListener(domMouseupListener);
          }

        }); // END of markerListener

        routeEditableListeners.push(markerListener);
      });
    },

    cleanUpRoutesEditor: function() {
      for (var i = 0; i < routeEditableListeners.length; i++) {
        google.maps.event.removeListener(routeEditableListeners[i]);
      }
    },


    // Complex Route Renderer
    //
    addComplexRoute: function(start, end) {
      var start = this.find(function(p) { return (!p._input && p.get('geometry').location.equals(start)) });
      var end   = this.find(function(p) { return (!p._input && p.get('geometry').location.equals(end)) });

      var route = _.find(routes, function(r) {
        return r.at(0) === end || r.at(r.length - 1) === start;
      });

      if (route) {
        if (route.at(0) === end) {
          route.unshift(start);
        } else {
          route.push(end);
        }
      } else {
        var route = new Route([start, end], {cancelableRoute: true});
        routes.push(route);
      }

      this.trigger('update');
    },


    // Server Communication
    //
    save: function(user) {
      var places = this.select(function(p) { return !p._input });
      var places = _.map(places, function(p, i) {
        return {
          order:         i,
          name:          p.get('name'),
          address:       p.get('formatted_address'),
          cover_picture: p.get('cover_picture'),
          location:      p.get('geometry').location.toUrlValue(),
          reference:     p.get('reference')
        };
      });

      var data = {
        mode:     UI.directionMode,
        owner_id: user._id,
        shared:   [],
        places:   places
      };

      if (UI.directionMode === 'customized') {
        data.routes = _.map(routes, function(r) {
          return r.map(function(p) {
            return p.get('geometry').location.toUrlValue();
          });
        });
      }

      if (this._autoSave) {
        $http.post($location.path(), {data: data});
      } else {
        var _this = this;
        $http.post('/save_list', {data: data}).success(function(data) {
          $location.path(data._id);
          _this.turnOnAutoSave();
        });
      }
    },

    fetch: function(path) {
      var _this = this;
      $http.get(path + '/data').success(function(data) {
        UI.directionMode = data.mode;
        for (var i = data.places.length - 1; i >= 0; i--) {
          var attrs = data.places[i];
          var coord = /(.+),(.+)/.exec(attrs.location);
          attrs.geometry = {location: new google.maps.LatLng(coord[1], coord[2])};
          var place = new Place(attrs);
          place.getMarker().setIcon('/img/location-icon-saved-place.png');
          _this.unshift(place, {silent: true});
        }
        _this.save({});
      });
    },

    turnOnAutoSave: function() {
      this._autoSave = true;
      var _this = this;
      this.on('update', function() {
        _this.save({});
      });
    }

  });

  return new SavedPlaces;
});


app.factory('DirectionsRenderer', function(Map, DirectionsService, BackboneEvents) {

  var colorCounter = 0;
  function randomColor() {
    var colors = ['1f77b4', 'ff7f0e', '2ca02c', 'd62728', '9467bd', '8c564b', 'e377c2', 'bcbd22', '17becf'];
    var color  = colors[colorCounter++];
    if (!color) {
      colorCounter = 0;
      color = colors[colorCounter++];
    }
    return color;
  }

  function createPolyline(path, defaultOptions, infoWindowContent) {
    var options = _.extend({path: path}, defaultOptions);
    polyline = new google.maps.Polyline(options);
    polyline.addListener('mouseover', function() {
      var anchor = new google.maps.MVCObject;
      anchor.set('position', path[Math.floor(path.length / 2)]);
      Map.showMouseoverInfoWindow(anchor, infoWindowContent);
    });
    polyline.setMap(Map.getMap());
    return polyline;
  }

  function generateDirectionLink(startL, destL) {
    return "http://maps.google.com/?saddr="+startL.toUrlValue()+
           "&daddr="+destL.toUrlValue()+
           "&directionsmode=driving";
  }


  // Renderer class
  //
  function Renderer() {
    var options = {
      strokeColor:   randomColor(),
      strokeWeight:  10,
      strokeOpacity: 0.5
    }

    this._polylines = [];

    this.renderWithResult = function(result) {
      for (var j = 0; j < result.routes[0].legs.length; j++) {
        var leg = result.routes[0].legs[j];
        var path = [];
        for (var i = 0; i < leg.steps.length; i++) {
          path = path.concat(leg.steps[i].path);
        }

        var content = leg.distance.text+', '+leg.duration.text+
            '<br><a href="'+
            generateDirectionLink(leg.start_location, leg.end_location)+
            '" target="_blank">Get step by step directions from Google</a>';

        this._polylines.push(createPolyline(path, options, content));
      }
      this.trigger('stabilized');
    };

    this.removeDirections = function() {
      for (var i = 0; i < this._polylines.length; i++) {
        this._polylines[i].setMap(null);
      };
    };

    this.getPolylines = function() {
      return this._polylines;
    };
  }
  _.extend(Renderer.prototype, BackboneEvents);


  var service  = {
    renderDirectionsWith: function(places) {
      var renderer  = new Renderer;
      var first     = places[0].get('geometry').location;
      var last      = places[places.length - 1].get('geometry').location;
      var waypoints = _.map(places.slice(1, places.length - 1), function(p) {
        return {location: p.get('geometry').location, stopover: true};
      });

      DirectionsService.route(
        {
          origin:      first,
          destination: last,
          waypoints:   waypoints,
          travelMode:  google.maps.TravelMode.DRIVING
        },
        function(result, status) {
          if (status === google.maps.DirectionsStatus.OK) {
            renderer.renderWithResult(result);
          }
        }
      );

      return renderer;
    }
  };

  return service;
});


app.value('validateEmail', function(email) {
  var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(email);
});


app.value('UI', {
  showDropzone:       false,
  showShareModal:     false,
  showDirectionModal: false,
  showSaveModal:      false,
  directionMode:      'none',

  hideAllModal: function() {
    this.showDirectionModal = false;
    this.showShareModal     = false;
    this.showSaveModal      = false
  }
});
