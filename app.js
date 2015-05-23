const http = require('http');
const path = require('path');
const express = require('express');
const config = require('config');
const morgan  = require('morgan');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');

const ENV = process.env.NODE_ENV || 'development';

const app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.set('view options', {layout: false});
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());
app.use(session({
  resave: false,
  saveUninitialized: false,
  secret: 'a random secret'
}));
app.use(express.static('public'));

if (ENV === 'development') {
  app.use(require('errorhandler')());
}

app.post('/save_user', require('./routes/save_user.js'));
app.post('/save_list', require('./routes/save_list.js'));
app.post('/send_email', require('./routes/send_email.js'));
app.get('/confirm/:user_id', require('./routes/confirm_email.js'));
app.get('/mobile/:list_id', require('./routes/mobile_list.js'));
app.post('/:list_id', require('./routes/save_list.js'));
app.get('/:list_id', require('./routes/index.js'));
app.get('/:list_id/data', require('./routes/get_list.js'));

http.createServer(app)
  .listen(config.get('port'), function () {
    console.log('Express server listening on port ' + config.get('port'));
  });
