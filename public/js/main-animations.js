
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
    // animation not trigger
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


app.animation('.js-saved-place', function() {
  return {
    enter: function(element, done) {
      element.css({height: 0}).animate({height: 40}, 200, function() {
        element.css({height: 'auto'});
        done();
      });
    },
    leave: function(element, done) {
      element.children().animate({left: -350}, 200);
      element.animate({height: 0}, 200, done);
    }
  };
});
