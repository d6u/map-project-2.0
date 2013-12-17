"use strict";


// --- mapApp ---
//
var app = angular.module('mapApp', ['ngBackbone', 'ngAnimate', 'ngBootstrap']);

app.config(function($locationProvider) {
  $locationProvider.html5Mode(true);
});

app.run(function($rootScope, SavedPlaces, SearchedPlaces, Map, UI, $location) {
  $rootScope.SavedPlaces    = SavedPlaces;
  $rootScope.SearchedPlaces = SearchedPlaces;
  $rootScope.Map = Map;
  $rootScope.UI  = UI;

  // md-sortable-places events
  //
  $rootScope.$on('placeRemoved', function(e, index) {
    SavedPlaces.removePlaceAt(index);
  });

  $rootScope.$on('placeListSorted', function(e, sortResult) {
    var place = SavedPlaces.at(sortResult.initIndex);
    SavedPlaces.remove(place, {silent: true});
    SavedPlaces.add(place, {at: sortResult.endIndex, silent: true});
    SavedPlaces.trigger('sort');
  });

  // init setup
  //
  var path = $location.path();
  if (path === '/') {
    SavedPlaces.addInputModel();
  } else {
    // this.fetch(path);
    // this.addInputModel();
    // this.turnOnAutoSave();
  }

  $rootScope.$watch('UI.directionMode', function(val, old) {
    SavedPlaces.trigger('directionModeChanged', val, old);
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
        string   = string.replace(/\n/g, '<br>');
        string   = string.replace(/ $/, '&nbsp;');
        string  += '<br>';
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

  function getMarkerIconUrl(collectionName) {
    return collectionName === 'SearchedPlaces' ?
           '/img/location-icon-search-result.png' :
           '/img/location-icon-saved-place.png';
  }

  return Backbone.Model.extend({

    initialize: function(attrs, options) {
      options = options || {};
      if (this._input = options.input) {
        this.clearDrawer = _.noop;
        return;
      }

      this.getDetails();

      this.on('add', function(_this, collection, options) {
        this.setIcon(getMarkerIconUrl(collection.name));
      });

      this.on('remove', function() {
        this.setMap(null);
      });
    },

    // get Place attributes infor
    //
    getDetails: function() {
      var _this = this;
      PlacesService.getDetails(this.get('reference'), function(result, status) {
        if (status === google.maps.places.PlacesServiceStatus.OK) {
          $rootScope.$apply(function() {
            _this.set(result);
            _this.parseShortAddress();
            _this.getCoverPhoto();
            _this.enter('attrsFetched');
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

    // Marker
    //
    setIcon: function(url) {
      if (this._marker) {
        this._marker.setIcon(url);
        this._marker.setMap(Map.getMap());
      } else {
        var _this = this;
        this.inState('attrsFetched', function() {
          _this.createMarker(url);
        });
      }
    },
    setMap: function(map) {
      this._marker.setMap(map);
    },
    createMarker: function(iconUrl) {
      var _this = this;
      this._marker = new google.maps.Marker({
        cursor:  'pointer',
        flat:     false,
        icon:     iconUrl,
        position: this.get('geometry').location,
        map:      Map.getMap()
      });
      // bind mouseover infoWindow
      this._marker.addListener('mouseover', function() {
        Map.showMouseoverInfoWindow(this, _this.get('name'));
      });
      this._marker.addListener('mouseout', function() {
        Map.closeMouseoverInfoWindow();
      });
    },
    getMarker: function() { return this._marker; },
    getPosition: function() { return this.getMarker().getPosition(); },

    // View
    //
    bindMouseoverInfowindowToElement: function() {
      var _this = this;
      this._element.on('mouseenter', function() {
        Map.showMouseoverInfoWindow(_this.getMarker(), _this.get('name'));
      });
      this._element.on('mouseleave', function() {
        Map.closeMouseoverInfoWindow();
      });
    },

    // Route Editable
    //
    clearDrawer: function() {
      google.maps.event.removeListener(this._routeEditableListener);
    },
    activeDrawer: function(places) {
      var event = google.maps.event;
      var _this = this;
      this._routeEditableListener = event.addListener(this.getMarker(), 'mousedown', function(e) {
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
            if (start != end) _this.trigger('connect', {start: start, end: end});
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
      });
    }

  });
});


app.factory('Route', function(Place, DirectionsRenderer) {

  var Route = Backbone.Collection.extend({

    name: 'Route',
    model: Place,

    initialize: function(places, options) {
      this._renderer = DirectionsRenderer.renderDirectionsWith(places);
      this._renderer.once('stabilized', this.addCancelableListener, this);
      this.on('add', function() {
        this._renderer.removeDirections();
        this._renderer = DirectionsRenderer.renderDirectionsWith(this.models);
        this._renderer.once('stabilized', this.addCancelableListener, this);
      });
      this.on('split', function(old, news) {
        Backbone.trigger('splitRoutes', old, news);
      });
    },

    // Route Management
    //
    destroy: function() {
      this._renderer.removeDirections();
    },
    connectableWith: function(connection) {
      if (this.length <= 1) {
        return false;
      } else if ( this.at(0).getPosition().equals(connection.end) ) {
        return -1;
      } else if ( this.last().getPosition().equals(connection.start) ) {
        return 1;
      } else {
        return false;
      }
    },
    isDuplicated: function(connection) {
      var i = this.getPlaceIndexWithLatlng(connection.start);
      if (i >= 0) {
        var p = this.at(i + 1);
        if (p && p.getPosition().equals(connection.end)) {
          return true;
        } else {
          return false;
        }
      }
    },
    getPlaceIndexWithLatlng: function(latLng) {
      var p = this.find(function(p) { return p.getPosition().equals(latLng); });
      return p ? this.indexOf(p) : -1;
    },

    addCancelableListener: function() {
      var polylines = this._renderer.getPolylines();
      var _this = this;
      _.forEach(polylines, function(pl) {
        google.maps.event.addListener(pl, 'rightclick', function() {
          if (_this.length === 2) {
            _this.trigger('split', _this, []);
            return;
          }
          var begin = this._start;
          var beginIndex = _this.indexOf(begin);
          if (beginIndex === 0) {
            var newRoute = new Route(_this.slice(1, _this.length));
            _this.trigger('split', _this, [newRoute]);
          } else {
            var end = this._end;
            var endIndex = _this.indexOf(end);
            if (endIndex === _this.length - 1) {
              var newRoute = new Route(_this.slice(0, _this.length - 1));
              _this.trigger('split', _this, [newRoute]);
            } else {
              var newRoute1 = new Route(_this.slice(0, beginIndex + 1));
              var newRoute2 = new Route(_this.slice(endIndex, _this.length));
              _this.trigger('split', _this, [newRoute1, newRoute2]);
            }
          }
        });
      });
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
          options.previousModels[i].trigger('remove');
        }
      });
    },

    searchWith: function(term) {
      var deferred = $q.defer();
      var _this = this;
      PlacesService.textSearch(term, function(result, status) {
        if (status === google.maps.places.PlacesServiceStatus.OK) {
          _this.set(result.splice(0, 5));
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
  var dummyContext = {};

  var SavedPlaces = Backbone.Collection.extend({

    name: 'SavedPlaces',
    model: Place,

    initialize: function() {
      this.on('directionModeChanged', this.changeDirectionStrategy);
      this.listenTo(Backbone, 'splitRoutes', function(old, news) {
        old.destroy();
        routes = _.without(routes, old);
        routes = routes.concat(news);
      });
    },

    // Input Model related
    //
    addInputModel: function(options) {
      options = typeof options === 'undefined' ? {} : options;
      var place = new Place(null, {input: true});
      this.add(place, {at: options.at != null ? options.at : this.length - 1});
    },
    resetInput: function() {
      this.find('_input')._element.find('textarea').val('').focus();
    },

    // Place Management
    //
    removePlaceAt: function(index) {
      var place = this.at(index);
      this.remove(place);
    },
    getPlaces: function() {
      return this.select(function(p) { return !p._input; });
    },

    // Render Directions
    //
    changeDirectionStrategy: function(mode, old) {
      this.clearDirectionStrategy();
      switch (mode) {
        case 'none':
          if (old === 'customized') {
            clearEditableRouteListener();
            this.stopListenToPlaceConnection();
          }
          clearRoutes();
          break;
        case 'linear':
          linearRouteUpdate();
          this.on('sort add remove', linearRouteUpdate, dummyContext);
          break;
        case 'sunburst':
          sunburstRouteUpdate();
          this.on('sort add remove', sunburstRouteUpdate, dummyContext);
          break;
        case 'sunburst-reverse':
          sunburstReverseRouteUpdate();
          this.on('sort add remove', sunburstReverseRouteUpdate, dummyContext);
          break;
        case 'customized':
          clearRoutes();
          enableRouteEditor();
          this.listenToPlaceConnection();
          this.on('add remove', enableRouteEditor, dummyContext);
          break;
      }
    },
    clearDirectionStrategy: function() {
      this.off(null, null, dummyContext);
    },
    listenToPlaceConnection: function() {
      var _this = this;
      for (var i = 0; i < this.models.length; i++) {
        this.listenTo(this.models[i], 'connect', function(connection) {
          _this.connectPlaces(connection);
        });
      }
      this.on('add', function(place) {
        _this.listenTo(place, 'connect', function(connection) {
          _this.connectPlaces(connection);
        });
      }, dummyContext);
    },
    stopListenToPlaceConnection: function() {
      for (var i = 0; i < this.models.length; i++) {
        this.stopListening(this.models[i]);
      }
    },
    connectPlaces: function(connection) { // start, end
      var route, position;
      for (var i = 0; i < routes.length; i++) {
        if (routes[i].isDuplicated(connection)) return;
      }
      for (var i = 0; i < routes.length; i++) {
        if (position = routes[i].connectableWith(connection)) {
          route = routes[i];
          if (position === 1) { // end
            var place = this.getPlaceWithLatlng(connection.end);
            route.push(place);
          } else { // start
            var place = this.getPlaceWithLatlng(connection.start);
            route.unshift(place);
          }
          return;
        }
      }
      var startPlace = this.getPlaceWithLatlng(connection.start);
      var endPlace   = this.getPlaceWithLatlng(connection.end);
      routes.push(new Route([startPlace, endPlace]));
    },
    getPlaceWithLatlng: function(latLng) {
      return this.find(function(p) { return p.getPosition().equals(latLng); });
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

  var service = new SavedPlaces;

  // Render Directions
  //
  function clearRoutes() {
    for (var i = 0; i < routes.length; i++) { routes[i].destroy(); }
    routes = [];
  }

  function linearRouteUpdate() {
    clearRoutes();
    var places = service.getPlaces();
    if (places.length > 1) {
      var route = new Route(places);
      routes.push(route);
    }
  }

  function sunburstRouteUpdate() {
    clearRoutes();
    var places = service.getPlaces();
    if (places.length > 1) {
      var first = places.shift();
      for (var i = 0; i < places.length; i++) {
        var route = new Route([first, places[i]]);
        routes.push(route);
      }
    }
  }

  function sunburstReverseRouteUpdate() {
    clearRoutes();
    var places = service.getPlaces();
    if (places.length > 1) {
      var last = places.pop();
      for (var i = 0; i < places.length; i++) {
        var route = new Route([places[i], last]);
        routes.push(route);
      }
    }
  }

  function clearEditableRouteListener() {
    for (var i = 0; i < service.models.length; i++) {
      service.models[i].clearDrawer();
    }
  }

  function enableRouteEditor() {
    var places = service.getPlaces();
    if (places.length > 1) {
      for (var i = 0; i < places.length; i++) {
        places[i].clearDrawer();
        places[i].activeDrawer(places);
      }
    } else if (places[0]) {
      places[0].clearDrawer();
    }
  }

  return service;
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
    var polyline = new google.maps.Polyline(options);
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

    this.renderWithResult = function(result, places) {
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

        var polyline = createPolyline(path, options, content);
        polyline._start = places[j];
        polyline._end   = places[j + 1];
        this._polylines.push(polyline);
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
            renderer.renderWithResult(result, places);
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
