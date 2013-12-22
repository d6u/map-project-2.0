app.animation('.md-place-item', function() {
  return {
    leave: function(element, done) {
      element.animate({height: 0}, 100, done);
    }
  };
});
