var gulp = require('gulp');
var path = require('path');
var open = require('gulp-open');

//  Copies bower dependencies into the client/vendor folder.
gulp.task('vendor', function() {

  gulp.src('bower_components/bootstrap/dist/**/*.*')
    .pipe(gulp.dest('client/vendor/bootstrap'));

  gulp.src(
    [
      'bower_components/angular/angular.js',
      'bower_components/angular-route/angular-route.js'
    ])
    .pipe(gulp.dest('client/vendor/angular'));

  gulp.src('bower_components/jquery/dist/*.*')
    .pipe(gulp.dest('client/vendor/jquery'));

  gulp.src('bower_components/angular-modal-service/dst/*.*')
    .pipe(gulp.dest('client/vendor/angular-modal-service'));

});

//  Serves the app, uses livereload.
function startApp() {
  
  require('./server/server.js').startServer();
}

//  Starts the live reload server
var lr;
function startLivereload() {
 
  lr = require('tiny-lr')();
  lr.listen(35729);
}

//  Notifies livereload of changes detected
function notifyLivereload(event) {
 
  lr.changed({
    body: {
      files: [path.relative(__dirname, event.path)]
    }
  });
}

gulp.task('default', function() {
  startApp();
  startLivereload();
  gulp.watch('client/**/*.*', function(event) {
    notifyLivereload(event);
  });

  gulp.src('./client/index.html')
    .pipe(open('<%file.path%>', {url: 'http://localhost:3000'}));
});