app.animation('.md-place-item', function() {
  return {
    enter: function(element, done) {
      var height = element.outerHeight();
      element.css('height', 0);
      element.animate({height: height}, 100, done);
    },
    leave: function(element, done) {
      element.animate({height: 0}, 100, done);
    }
  };
});
