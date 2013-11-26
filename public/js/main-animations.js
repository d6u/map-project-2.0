
app.animation('.md-searched-places', function() {
  return {
    beforeAddClass: function(element, className, done) {
      if(className == 'ng-hide') {
        element.css('opacity', 1);
        element.animate({opacity: 0}, 200, done);
      }
      else {
        done();
      }
    },

    // FIXME
    removeClass: function(element, className, done) {
      if(className == 'ng-hide') {
        element.css('opacity', 0);
        element.animate({opacity: 1}, 200, done);
      }
      else {
        done();
      }
    }
  };
});
