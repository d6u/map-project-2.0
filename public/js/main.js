"use strict";


// --- mapApp ---
//
var app = angular.module('mapApp', ['ngBackbone', 'ngAnimate', 'ngBootstrap']);

app.config(function($locationProvider) {
  $locationProvider.html5Mode(true);
});

app.run(function($rootScope, SavedPlaces, SearchedPlaces, Map, UI, $location, $http, Place, Route, $q, List) {
  $rootScope.SavedPlaces    = SavedPlaces;
  $rootScope.SearchedPlaces = SearchedPlaces;
  $rootScope.Map = Map;
  $rootScope.UI  = UI;
  $rootScope.List = List;

  $rootScope.displayAllMarkers = function(infoPanelShowed) {
    if (SavedPlaces.length > 1 || SearchedPlaces.length) {
      var bounds = new google.maps.LatLngBounds();
      SavedPlaces.forEach(function(p) {
        if (!p._input) bounds.extend(p.getPosition());
      });
      SearchedPlaces.forEach(function(p) {
        bounds.extend(p.getPosition());
      });
      Map.fitBounds(bounds, infoPanelShowed);
      if (Map.getZoom() > 9) Map.setZoom(9);
    }
  };

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
    $rootScope.list = {name: 'iWantMap Project'};
    watchDirectionModeChange();
  } else {
    $http.get(path+'/data').success(function(data) {

      List.set({title: data.name, _id: data._id});

      // Load Data into SavedPlaces
      UI.directionMode = data.mode;

      var places = [];
      var placesReady = [];
      _.forEach(data.places, function(p) {
        var placeDefer = $q.defer();
        placesReady.push(placeDefer.promise);
        var place = new Place(p);
        place.inState('attrsFetched', function() {
          place.createMarker();
          placeDefer.resolve();
        });
        places.push(place);
      });

      $q.all(placesReady).then(function() {
        SavedPlaces.set(places);
        if (data.mode === 'customized') {
          var routes = [];
          for (var i = 0; i < data.routes.length; i++) {
            var routePlaces = [];
            for (var j = 0; j < data.routes[i].length; j++) {
              routePlaces.push( SavedPlaces.findWhere({id: data.routes[i][j]}) );
            }
            routes.push(new Route(routePlaces));
          }
        }

        SavedPlaces.addInputModel({at: SavedPlaces.length});
        watchDirectionModeChange();

        // prevent trigger auto save when `$watch` triggers once during init
        setTimeout(function() {
          if (data.mode === 'customized' && routes.length) {
            SavedPlaces.addRoute(routes);
          }
          SavedPlaces.enableAutoSave();
          $rootScope.displayAllMarkers();
        });

      });

    })
    .error(function() {
      $location.path('');
      SavedPlaces.addInputModel();
    });
  }


  function watchDirectionModeChange() {
    $rootScope.$watch('UI.directionMode', function(val, old) {
      SavedPlaces.trigger('directionModeChanged', val, old);
    });
  }

});


// --- Directives ---
//
app.directive('mdMapCanvas', function(Map) {
  return function(scope, element) { Map.setCanvas(element[0]); };
});


app.directive('mdInfoPanel', function(SearchedPlaces, SavedPlaces) {
  return function(scope, element, attrs) {
    element.on('click', '#search-term-prediction', function() {
      var term = $(this).html();
      SearchedPlaces.searchWith(term, {noPrediction: true});
      SavedPlaces.resetInput(term);
    });
  };
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
            SearchedPlaces.reset();
            SearchedPlaces.hint = [];
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


app.directive('mdPlaceInput', function(SearchedPlaces, SavedPlaces) {
  return {
    controllerAs: 'mdPlaceInputCtrl',
    controller: function($scope, $element) {
      var textarea = $element.children('.md-place-input-textarea');
      this.clearInput = function() {
        textarea.val('');
        SearchedPlaces.reset();
        SearchedPlaces.hint = [];
        $scope.place._cancelable = false;
        delete this.lastTerm;
        textarea.trigger('keyup');
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

      function saveFirstSearchResult() {
        if ( SearchedPlaces.length ) {
          var place = SearchedPlaces.at(0);
          SearchedPlaces.remove(place);
          SearchedPlaces.reset();
          SearchedPlaces.hint = [];
          var inputModel = SavedPlaces.find('_input');
          var index = SavedPlaces.indexOf(inputModel);
          SavedPlaces.add(place, {at: index});
          SavedPlaces.resetInput();
        }
      }


      element.on('keydown', function(e) {
        switch (e.keyCode) {
          case 8: updateDimensions(textarea.val().replace(/[\s\S]$/, '')); break;
          case 9: e.preventDefault(); break;
        }
      });

      element.on('keypress', function(e) {
        var char   = String.fromCharCode(e.keyCode);
        var string = textarea.val() + char;
        updateDimensions(string);
        if (e.keyCode === 13) {
          e.preventDefault();
          saveFirstSearchResult();
        }
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
      zIndex:       2100, // > .ly-drop-zone
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
        ui.placeholder.css('height', ui.item.outerHeight());
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


app.directive('mdSaveModal', function($http, UI, $location, SavedPlaces, $rootScope) {
  return {
    controllerAs: 'MdSaveModalCtrl',
    controller: function($scope) {
      // this.form
      this.list = {};

      this.save = function() {
        if (this.form.$valid && $location.path() != '/') {
          SavedPlaces.save();
          UI.hideAllModal();
          return;
        }
        if (this.form.$valid) {
          if (!this.list.title) $rootScope.list.name = this.list.title = 'Untitled list';
          $http.post('/save_user', this.list).success(function(user) {
            var saved = SavedPlaces.save({user: user});

            // if email already confirmed
            // send email of this list to target email address after saving
            if (user.c) {
              saved.success(function(data) {
                $http.post('/send_email', {
                  self_only: true,
                  sender:    user.e,
                  list_id:   data._id
                });
              });
            }

          });
          UI.hideAllModal();
        }
      }
    },
    link: function(scope, element, attrs) {}
  };
});


app.directive('mdShareModal', function($animate, UI, validateEmail, $location, $http, SavedPlaces, $q) {
  return {
    controllerAs: 'MdShareModalCtrl',
    controller: function($scope) {

      this.save = function(options) {
        options = options || {};
        if (!options.selfOnly) {
          if (typeof this.list.receivers === 'undefined') {
            this.formHelp.receiversHelpWarning = true;
            this.formHelp.receiversHelp = "Receivers cannot be empty";
            return false;
          } else {
            this.list.receivers = this.list.receivers.replace(/\s*$/, '');
            if (this.list.receivers.length === 0) {
              this.formHelp.receiversHelpWarning = true;
              this.formHelp.receiversHelp = "Receivers cannot be empty";
              return false;
            }
          }
          var receivers = this.list.receivers.split(/,\s*/g);
          for (var i = 0; i < receivers.length; i++) {
            if (!validateEmail(receivers[i])) {
              this.formHelp.receiversHelpWarning = true;
              this.formHelp.receiversHelp = '"'+receivers[i]+'" is not a valid email.';
              return false;
            }
          }
        }

        if (this.form.$valid) {
          if ($location.path() === '/') {
            var deferred = $q.defer();
            if (!this.list.title) $rootScope.list.name = this.list.title = 'Untitled list';
            $http.post(
              '/save_user',
              {
                sender: this.list.sender,
                title:  this.list.title
              }
            ).success(function(user) {
              deferred.resolve(SavedPlaces.save({user: user}));
            });
            return deferred.promise;
          } else {
            return SavedPlaces.save();
          }
        } else {
          this.formHelp.senderHelpWarning = true;
          this.formHelp.senderHelp = "You have to enter your email.";
          return false;
        }
      }

    },
    link: function(scope, element, attrs, Ctrl) {

      Ctrl.list = {};

      function restoreFormHelp() {
        Ctrl.formHelp = {
          senderHelp:       'We will send you a confirmation email first.',
          senderHelpWarning: false,
          receiversHelp:    "Separate receiver's email addresses by comma.",
          receiversHelpWarning: false
        }
      }
      restoreFormHelp();

      scope.$watch('list.name', function(val) { Ctrl.list.title = val; });

      function bounceUpAnimation() {
        var child = element.children('.cp-modal-content');
        $animate.addClass(child, 'bounce-up-effect', function() {
          child.css('display', 'none');
          child.removeClass('bounce-up-effect');
          scope.$apply(function() { UI.hideAllModal(); });
          child.css('display', '');
        });
      }

      Ctrl.sendToSender = function() {
        var saved = Ctrl.save({selfOnly: true});
        if (saved) {
          saved.then(function() {
            $http.post(
              "/send_email",
              {
                self_only: true,
                sender:    Ctrl.list.sender,
                list_id:   scope.list._id
              }
            );
          });
          bounceUpAnimation();
          restoreFormHelp();
        } else {
          Ctrl.formHelp.senderHelpWarning = true;
          Ctrl.formHelp.senderHelp = "You have to enter your email.";
        }
      };

      Ctrl.send = function() {
        var saved = Ctrl.save();
        if (saved) {
          saved.then(function() {
            $http.post(
              "/send_email",
              {
                sender:    Ctrl.list.sender,
                list_id:   scope.list._id,
                receivers: Ctrl.list.receivers.split(/,\s*/g)
              }
            );
          });
          bounceUpAnimation();
          restoreFormHelp();
        }
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
      "elementType": "geometry.fill",
      "stylers": [{
        "color": "#5D9CEC"
      }, {
        "visibility": "on"
      }]
    }
  ];

  var defaultMapOptions = {
    center:       new google.maps.LatLng(40.77, -73.98),
    zoom:         5,
    styles:       mapStyles,
    panControl:   false,
    scaleControl: true,
    zoomControlOptions: {
      position: google.maps.ControlPosition.RIGHT_CENTER
    }
  };

  var Map = {
    _mouseoverInfoWindowFlag: true,

    setCanvas: function(element) {
      this.setMap(new google.maps.Map(element, defaultMapOptions));
      this.enter('ready');
    },
    setMap:    function(map)    { this._googleMap = map; },
    getMap:    function()       { return this._googleMap; },
    getBounds: function()       { return this.getMap().getBounds(); },

    // Improve fitBounds not to hide markers under info-panel
    fitBounds: function(bounds, infoPanelShowed) {
      if ( !$('[md-info-panel]').hasClass('ng-hide') || infoPanelShowed) {
        var boundsPixels = getBoundsPixels(bounds);
        var fittedBoundsPixels = getFittedBoundsPixels(boundsPixels);
        var finalBounds = getFinalBounds(fittedBoundsPixels);
        this.getMap().fitBounds(finalBounds);
      } else {
        this.getMap().fitBounds(bounds);
      }
    },

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
      if (!this._mouseoverInfoWindowFlag) return;
      var content = document.createElement('div');
      content.innerHTML = title;
      content.style.lineHeight = '18px';
      mouseoverInfoWindow.setContent(content);
      mouseoverInfoWindow.open(this.getMap(), marker);
    },
    closeMouseoverInfoWindow: function() {
      mouseoverInfoWindow.close();
    },
    disableMouseoverInfoWindow: function() {
      this._mouseoverInfoWindowFlag = false;
    },
    enableMouseoverInfoWindow: function() {
      this._mouseoverInfoWindowFlag = true;
    }
  };
  _.extend(Map, BackboneEvents);


  // Conver latLng coordinate to pixel coordinate on map
  // source: https://developers.google.com/maps/documentation/javascript/examples/map-coordinates?csw=1
  //
  var TILE_SIZE = 256;

  function bound(value, opt_min, opt_max) {
    if (opt_min != null) value = Math.max(value, opt_min);
    if (opt_max != null) value = Math.min(value, opt_max);
    return value;
  }

  function degreesToRadians(deg) {
    return deg * (Math.PI / 180);
  }

  function radiansToDegrees(rad) {
    return rad / (Math.PI / 180);
  }

  function MercatorProjection() {
    this.pixelOrigin_ = new google.maps.Point(TILE_SIZE / 2, TILE_SIZE / 2);
    this.pixelsPerLonDegree_ = TILE_SIZE / 360;
    this.pixelsPerLonRadian_ = TILE_SIZE / (2 * Math.PI);
  }

  MercatorProjection.prototype.fromLatLngToPoint = function(latLng, opt_point) {
    var me = this;
    var point = opt_point || new google.maps.Point(0, 0);
    var origin = me.pixelOrigin_;

    point.x = origin.x + latLng.lng() * me.pixelsPerLonDegree_;

    // Truncating to 0.9999 effectively limits latitude to 89.189. This is
    // about a third of a tile past the edge of the world tile.
    var siny = bound(Math.sin(degreesToRadians(latLng.lat())), -0.9999, 0.9999);
    point.y = origin.y + 0.5 * Math.log((1 + siny) / (1 - siny)) * -me.pixelsPerLonRadian_;
    return point;
  };

  MercatorProjection.prototype.fromPointToLatLng = function(point) {
    var me = this;
    var origin = me.pixelOrigin_;
    var lng = (point.x - origin.x) / me.pixelsPerLonDegree_;
    var latRadians = (point.y - origin.y) / -me.pixelsPerLonRadian_;
    var lat = radiansToDegrees(2 * Math.atan(Math.exp(latRadians)) - Math.PI / 2);
    return new google.maps.LatLng(lat, lng);
  };


  // Functions to convert latLng coordinate to pixels coordinate and vice versa
  function fromLatLngToPixel(latLng) {
    var numTiles = 1 << Map.getZoom();
    var projection = new MercatorProjection();
    var worldCoordinate = projection.fromLatLngToPoint(latLng);

    return {x: worldCoordinate.x * numTiles, y: worldCoordinate.y * numTiles};
  }

  // pixels: {x: Number, y: Number}
  function fromPixelToLatLng(pixels) {
    var numTiles = 1 << Map.getZoom();
    var projection = new MercatorProjection();
    var point = new google.maps.Point(pixels.x / numTiles, pixels.y / numTiles);

    return projection.fromPointToLatLng(point);
  }


  function getBoundsPixels(bounds) {
    var ne = fromLatLngToPixel(bounds.getNorthEast())
      , sw = fromLatLngToPixel(bounds.getSouthWest());
    return {ne: ne, sw: sw};
  }

  function getFittedBoundsPixels(boundsPixels) {
    var mapCanvas = $('[md-map-canvas]');
    var w = mapCanvas.width()
      , h = mapCanvas.height();
    var w1 = boundsPixels.ne.x - boundsPixels.sw.x
      , h1 = boundsPixels.sw.y - boundsPixels.ne.y;

    if (h / w > h1 / w1) {
      var h_full  = w1 * h / w;
      var h_extra = ( h_full - h1 ) / 2;
      return {
        sw: { x: boundsPixels.sw.x, y: boundsPixels.sw.y + h_extra },
        ne: { x: boundsPixels.ne.x, y: boundsPixels.ne.y - h_extra }
      };
    } else {
      var w_full  = h1 * w / h;
      var w_extra = ( w_full - w1 ) / 2;
      return {
        sw: { x: boundsPixels.sw.x - w_extra, y: boundsPixels.sw.y },
        ne: { x: boundsPixels.ne.x + w_extra, y: boundsPixels.ne.y }
      };
    }
  }

  function getFinalBounds(fittedBoundsPixels) {
    var sw = fittedBoundsPixels.sw
      , ne = fittedBoundsPixels.ne;
    var w1 = ne.x - sw.x
      , w  = $('[md-map-canvas]').width();
    var x  = 370 * w1 / ( w - 370 );
    var new_sw = { x: sw.x - x, y: sw.y };

    return new google.maps.LatLngBounds(fromPixelToLatLng(new_sw),
                                        fromPixelToLatLng(ne));
  }


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
        } else if (status === google.maps.places.PlacesServiceStatus.OVER_QUERY_LIMIT) {
          setTimeout(function() { _this.getDetails(); }, 1000);
        }
      });
    },
    parseShortAddress: function() {
      this.set('short_address', this.get('formatted_address'));
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
    getPosition: function() {
      var marker = this.getMarker();
      return marker ? marker.getPosition() : this.get('geometry').location;
    },

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
        Map.disableMouseoverInfoWindow();
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
          Map.enableMouseoverInfoWindow();
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


app.factory('SearchedPlaces', function($rootScope, Backbone, Place, Map, PlacesService, $q, PlacesAutocompleteService) {

  var SearchedPlaces = Backbone.Collection.extend({

    name: 'SearchedPlaces',
    model: Place,
    hint: [],

    initialize: function() {
      this.on('reset', function(c, options) {
        for (var i = 0; i < options.previousModels.length; i++) {
          options.previousModels[i].trigger('remove');
        }
      });
    },

    searchWith: function(term, options) {
      options = options || {};
      var deferred = $q.defer();
      var _this = this;

      if (!options.noPrediction) {
        PlacesAutocompleteService.getQueryPredictions({
          bounds: Map.getBounds(),
          input: term,
        }, function(result, status) {
          if (status === google.maps.places.PlacesServiceStatus.OK) {
            _this.hint[1] = result[0].description;
          } else {
            _this.hint[1] = '';
          }
        });
      } else {
        this.hint[1] = '';
      }

      PlacesService.textSearch(term, function(result, status) {
        $rootScope.$apply(function() {
          if (status === google.maps.places.PlacesServiceStatus.OK) {
            _this.hint[0] = '';
            _this.set(result.splice(0, 8));
            $rootScope.displayAllMarkers(true);
            deferred.resolve();
          } else {
            _this.hint[0] = "Sorry no result found.";
            _this.reset();
            deferred.reject();
          }
        });
      });

      return deferred.promise;
    }

  });

  return new SearchedPlaces;
});


app.factory('SavedPlaces', function(Backbone, $location, Route, Place, Map, $rootScope, UI, BackboneEvents, $http, List) {

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
        this.trigger('routeUpdated');
      });
    },

    // Input Model related
    //
    addInputModel: function(options) {
      options = typeof options === 'undefined' ? {} : options;
      var place = new Place(null, {input: true});
      this.add(place, {at: options.at != null ? options.at : this.length - 1});
    },
    resetInput: function(val) {
      val = val || '';
      var $el = this.find('_input')._element.find('textarea');
      $el.val(val);

      // move cursor to end
      if (val) {
        var el = $el[0];
        if (typeof el.selectionStart == "number") {
          el.selectionStart = el.selectionEnd = el.value.length;
        } else if (typeof el.createTextRange != "undefined") {
          el.focus();
          var range = el.createTextRange();
          range.collapse(false);
          range.select();
        }
        $el.trigger('keyup');
      }

      $el.focus();
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

    // Route Management
    //
    addRoute: function(newRoute) {
      routes = newRoute;
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
          this.trigger('routeUpdated');
          return;
        }
      }
      var startPlace = this.getPlaceWithLatlng(connection.start);
      var endPlace   = this.getPlaceWithLatlng(connection.end);
      routes.push(new Route([startPlace, endPlace]));
      this.trigger('routeUpdated');
    },
    getPlaceWithLatlng: function(latLng) {
      return this.find(function(p) { return p.getPosition().equals(latLng); });
    },

    // Server Communication
    //
    save: function(options) {
      options = options || {};
      var places = _.map(this.getPlaces(), function(p, i) {
        return {
          id:            p.get('id'),
          order:         i,
          name:          p.get('name'),
          address:       p.get('formatted_address'),
          cover_picture: p.get('cover_picture'),
          location:      p.get('geometry').location.toUrlValue(),
          reference:     p.get('reference')
        };
      });

      var data = {
        name:     List.get('title'),
        mode:     UI.directionMode,
        owner_id: (options.user && $location.path() != '/') ? options.user._id : null,
        // shared:   [],
        places:   places
      };

      if (UI.directionMode === 'customized') {
        data.routes = _.map(routes, function(r) {
          return r.map(function(p) {
            return p.get('id');
          });
        });
      }

      if ($location.path() != '/') {
        var promise = $http.post($location.path(), {data: data});
      } else {
        var _this = this;
        var promise = $http.post('/save_list', {data: data})
        .success(function(data) {
          $location.path(data._id);
          List.set({name: data.name, _id: data._id});
          _this.enableAutoSave();
        });
      }

      return promise;
    },
    enableAutoSave: function() {
      var _this = this;
      this.on('add remove sort routeUpdated directionModeChanged', function() {
        this.save();
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
  showDropzone:   false,
  showShareModal: false,
  showSaveModal:  false,
  directionMode:  'none',
  showDirectionModal: false,

  hideAllModal: function() {
    this.showDirectionModal = false;
    this.showShareModal     = false;
    this.showSaveModal      = false
  }
});


app.factory('List', function(Backbone) {
  var List = Backbone.Model.extend({
    initialize: function() {
      this.set({title: 'iWantMap Project'});
    }
  });

  return new List;
});


app.filter('SearchedPlacesHintFilter', function($sce) {

  function getHintText(text) {
    return 'Did you mean "<a href id="search-term-prediction">'+ text +'</a>"?';
  }

  return function(input) {
    if (input[0] || input[1]) {
      input.show = true;
      if (input[0] && input[1]) {
        return $sce.trustAsHtml(input[0] + getHintText(input[1]));
      } else if (input[0]) {
        return $sce.trustAsHtml(input[0]);
      } else {
        return $sce.trustAsHtml(getHintText(input[1]));
      }
    } else {
      input.show = false;
      return $sce.trustAsHtml('');
    }
  };
});
