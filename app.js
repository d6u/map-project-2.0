
var express = require('express');
var http    = require('http');
var path    = require('path');

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
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
app.post('/share_list'         , require('./routes/share_list.js'));
app.post('/share_list/:list_id', require('./routes/share_list.js'));
app.get( '/confirm/:user_id'   , require('./routes/confirm_email.js'));

app.get( '/:list_id'           , require('./routes/index.js'));
app.post('/:list_id'           , require('./routes/edit_list.js'));
app.get( '/:list_id/data'      , require('./routes/get_list_data.js'));


http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});