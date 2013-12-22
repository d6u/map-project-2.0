'use strict';


module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    clean: ['./public_production'],

    copy: {
      production: {
        files: [{
          expand: true,
          cwd: './public/',
          src: ['**'],
          dest: './public_production/'
        }]
      }
    },

    sass: {
      dist: {
        files: {
          './public_production/css/main.css':        './scss/main.scss',
          './public_production/css/main-mobile.css': './scss/main-mobile.scss'
        }
      }
    },

    autoprefixer: {
      production: {
        src: './public_production/css/main*.css'
      }
    },

    cssmin: {
      production: {
        expand: true,
        cwd:  './public_production/css/',
        src: ['main*.css', '!*.min.css'],
        dest: './public_production/css/',
        ext:  '.css'
      }
    },

    uglify: {
      production: {
        files: {
          './public_production/js/main.js':           './public/js/main.js',
          './public_production/js/main-animations.js':'./public/js/main-animations.js',
          './public_production/js/main-mobile.js':    './public/js/main-mobile.js',
          './public_production/js/ng-backbone.js':    './public/js/ng-backbone.js',
          './public_production/js/ng-bootstrap.js':   './public/js/ng-bootstrap.js'
        }
      }
    }

  });


  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-sass');
  grunt.loadNpmTasks('grunt-autoprefixer');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-contrib-uglify');


  grunt.registerTask('default', ['clean', 'copy', 'sass', 'autoprefixer', 'cssmin', 'uglify']);

};
