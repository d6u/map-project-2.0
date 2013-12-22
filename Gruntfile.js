module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    sass: {
      dist: {
        files: {
          './public/css/main.css':        './scss/main.scss',
          './public/css/main-mobile.css': './scss/main-mobile.scss'
        }
      }
    },

    autoprefixer: {
      production: {
        src: './public/css/main*.css'
      }
    },

    cssmin: {
      production: {
        expand: true,
        cwd:  './public/css/',
        src: ['main*.css', '!*.min.css'],
        dest: './public/css/',
        ext:  '.min.css'
      }
    },

    uglify: {
      production: {
        files: {
          './public/js/main.min.js':           './public/js/main.js',
          './public/js/main-animations.min.js':'./public/js/main-animations.js',
          './public/js/main-mobile.min.js':    './public/js/main-mobile.js',
          './public/js/ng-backbone.min.js':    './public/js/ng-backbone.js',
          './public/js/ng-bootstrap.min.js':   './public/js/ng-bootstrap.js'
        }
      }
    }

  });


  grunt.loadNpmTasks('grunt-contrib-sass');
  grunt.loadNpmTasks('grunt-autoprefixer');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-contrib-uglify');


  grunt.registerTask('default', ['sass', 'autoprefixer', 'cssmin', 'uglify']);

};
