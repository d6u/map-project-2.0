// Request Animation Frame Polyfill
//
(function() {
  var lastTime = 0;
  var vendors = ['ms', 'moz', 'webkit', 'o'];
  for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
    window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
    window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame']
                               || window[vendors[x]+'CancelRequestAnimationFrame'];
  }

  if (!window.requestAnimationFrame)
    window.requestAnimationFrame = function(callback, element) {
      var currTime = new Date().getTime();
      var timeToCall = Math.max(0, 16 - (currTime - lastTime));
      var id = window.setTimeout(function() { callback(currTime + timeToCall); },
        timeToCall);
      lastTime = currTime + timeToCall;
      return id;
    };

  if (!window.cancelAnimationFrame)
    window.cancelAnimationFrame = function(id) {
      clearTimeout(id);
    };
}());



(function(window, $, undefined) {
'use strict';

// Use window on load to provide accurate positions
$(window).on('load', function() {

  function renderLines() {
    $('.md-route').each(function(i, route) {

      var heights = [];
      var svg = Snap('#js-route-connection-line-'+i);

      $(route).find('.md-route-place').each(function(i, place) {
        var position = $(place).position()
          , counter  = 1;
        heights.push(position.top + 10 + 20 / 2);

        var circle = svg.circle(20, position.top + 10 + 20 / 2);
        circle.attr({fill: '#4A89DC'});

        (function animloop() {
          if (counter <= 30) {
            window.requestAnimationFrame(animloop);
            counter++;
            circle.attr({r: 5 / 30 * counter});
          }
        })();
      });

      var pathString = 'M20 '+heights[0];
      for (var i = 1; i < heights.length; i++) {
        pathString += 'L20 '+heights[i];
      }
      var path = svg.path(pathString);
      path.attr({stroke: '#4A89DC'});

      var pathAnimateCounter = 1;
      (function animloop() {
        if (pathAnimateCounter <= 30) {
          window.requestAnimationFrame(animloop);
          pathAnimateCounter++;
          path.attr({'stroke-width': 4 / 30 * pathAnimateCounter});
        }
      })();

    });
  }

  function repositionLines() {
    $('.md-route').each(function(i, route) {

      var heights = [];
      var svg = Snap('#js-route-connection-line-'+i);

      $(route).find('.md-route-place').each(function(i, place) {
        var position = $(place).position();
        heights.push(position.top + 10 + 20 / 2);
      });

      var circles = svg.selectAll('circle');
      var pathString = 'M20 '+heights[0];

      for (var i = 0; i < circles.length; i++) {
        circles[i].attr({cy: heights[i]});
        if (i)
          pathString += 'L20 '+heights[i];
      }

      var path = svg.select('path').attr({d: pathString});

    });
  }

  renderLines();


  // Reposition UI if Dimensions Changed
  $(window).on('resize', repositionLines);

});

})(window, jQuery);
