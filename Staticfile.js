'use strict';

const sass = require('node-sass');
const autoprefixer = require('autoprefixer-core');

module.exports = function (configPipeline) {

  configPipeline.tasks = {
    scss: {
      files: [{
        src: 'scss/main.scss',
        dest: 'public/css/main.css'
      }, {
        src: 'scss/main-mobile.scss',
        dest: 'public/css/main-mobile.css'
      }],
      process: function (p) {
        sass.render({
          file: p.src,
          outputStyle: 'expanded'
        }, function (err, result) {
          p.done(autoprefixer.process(result.css).css);
        });
      }
    }
  };

};
