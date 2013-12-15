

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
