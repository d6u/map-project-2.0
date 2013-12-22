// Karma configuration
// Generated on Tue Dec 03 2013 00:42:22 GMT-0500 (EST)

module.exports = function(config) {
  config.set({

  // base path, that will be used to resolve files and exclude
  basePath: '',


  // frameworks to use
  frameworks: ['jasmine'],


  // list of files / patterns to load in the browser
  files: [
    // "//maps.googleapis.com/maps/api/js?key=AIzaSyAGJjfEZSf93ey42aqJDIVuOVaLnpUUzWs&libraries=places&sensor=true",
    "./public/js/jquery-1.10.2.min.js",
    "./public/js/bootstrap.min.js",
    "./public/js/jquery-ui-1.10.3.custom.min.js",
    "./public/js/lodash.compat.min.js",
    "./public/js/backbone-min.js",
    "./public/js/angular.min.js",
    "./public/js/angular-animate.min.js",
    "./public/js/angular-route.min.js",
    "./public/js/angular-cookies.min.js",
    "./public/js/angular-sanitize.min.js",
    "./public/js/angular-touch.min.js",
    // "./public/js/main.js",
    // "./public/js/main-animations.js",
    './test/angular-mocks.js',
    './test/*.js'
  ],


  // list of files to exclude
  exclude: [

  ],


  // test results reporter to use
  // possible values: 'dots', 'progress', 'junit', 'growl', 'coverage'
  reporters: ['progress'],


  // web server port
  port: 9876,


  // enable / disable colors in the output (reporters and logs)
  colors: true,


  // level of logging
  // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
  logLevel: config.LOG_INFO,


  // enable / disable watching file and executing tests whenever any file changes
  autoWatch: true,


  // Start these browsers, currently available:
  // - Chrome
  // - ChromeCanary
  // - Firefox
  // - Opera (has to be installed with `npm install karma-opera-launcher`)
  // - Safari (only Mac; has to be installed with `npm install karma-safari-launcher`)
  // - PhantomJS
  // - IE (only Windows; has to be installed with `npm install karma-ie-launcher`)
  browsers: ['Chrome'],


  // If browser does not capture in given timeout [ms], kill it
  captureTimeout: 60000,


  // Continuous Integration mode
  // if true, it capture browsers, run tests and exit
  singleRun: false
  });
};
