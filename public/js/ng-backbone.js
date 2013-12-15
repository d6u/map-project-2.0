

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
