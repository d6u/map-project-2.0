
var express = require('express');
var http    = require('http');
var path    = require('path');

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.set('view options', {layout: false});
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(express.cookieParser('your secret here'));
app.use(express.session());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}


// Routes
//
app.post('/save_user'    , require('./routes/save_user.js'));
app.post('/save_list'    , require('./routes/save_list.js'));
app.post('/send_email'   , require('./routes/send_email.js'));
app.get( '/confirm/:user_id', require('./routes/confirm_email.js'));
app.get( '/mobile/:list_id' , require('./routes/mobile_list.js'));
app.post('/:list_id'     , require('./routes/save_list.js'));
app.get( '/:list_id'     , require('./routes/index.js'));
app.get( '/:list_id/data', require('./routes/get_list.js'));


http.createServer(app).listen(app.get('port'), function() {
  console.log('Express server listening on port ' + app.get('port'));
});
