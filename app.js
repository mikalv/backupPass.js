var fs = require('fs');
var bodyParser = require('body-parser');
var tmp = require('tmp');
tmp.setGracefulCleanup();

// Load custom crypto functions
var my_crypto = require('./my_crypto.js');

// Load KeePassIO functions
var kp = require('./kp_functions.js');

// Load sequential execution functions
var series = require('./sequential.js');


// Load express
var express = require('express');
var app = express();
app.use(bodyParser()); // support for URL-encoded bodies in posts


/* 
 *            Application Logic
 *
 */

var passwords = [];
var clear_key = "";
var login_attempts = 0;
var login_pause = false;
var lockout = false;

var write_tmp_file = function (data, next) {
  tmp.file(function _tempFileCreated(err, path, fd) {
    if (err) throw err;

    console.log("File: ", path);
    console.log("File descriptor: ", fd);

    fs.writeFileSync(path, data, 'utf8');
    next(path);
  });
};

var list_accts = function(key, keyfile, next) {
  kp.get_accts('./keepass/test.kdbx', key, keyfile, function(error, accts, pass) {
    html = "";
    if (error) {
      bad_login();
      html="Incorrect Password<br>Wait 2 seconds before retrying";
    }
    else {
      accts.forEach(function(entry) {
        html += "<li class='acct'>" + entry + "</li>";
      });
      passwords = pass;
    }
  fs.unlink(keyfile, function (err) {
    if (err) {
      throw err;
    }
    console.log("Deleted: " + keyfile);
  });
  next(html);
  });
};

var bad_login = function() {
  login_attempts += 1;
  login_pause = true;

  setTimeout(function() {
    login_pause = false;
  }, 2000);

  if (login_attempts > 2) {
    lockout = true;
    server.close();
  }
};

/*
 *
 *        Routing
 *
 */

app.all('*', function(req, res, next) {
  if (lockout === false && login_pause === false) {
    if (process.env.NODE_ENV == "production") {
      if (req.headers['x-forwarded-proto']=='https') {
        next();
      }
    } else {
      next();
    }
  }
});

app.get('/', function (req, res) {
  res.sendfile('./public/index.html');
});

app.get('/lock', function(req, res) {
  lockout = true;
  res.send("Locked");
});

app.get('/style.css', function(req, res) {
  res.sendfile('./public/style.css');
});

app.get('/index.js', function(req, res) {
  res.sendfile('./public/index.js');
});

app.post('/show', function(req, res) {
  var index= req.body.index;
  html = "<span>Password: " + passwords[index] +"</span>";
  res.send(html);
});

app.post('/list', function(req, res) {
  var kdbx_pass = req.body.pass;

  var render = function(html) {
    res.send(html);
  };
  // List of functions to be executed sequentially
  s = [function(next) { write_tmp_file(clear_key, next); }, function(result, next) { list_accts(kdbx_pass, result, next); } ];

  // This is a little tricky:
  // Takes an array of functions, passes the result from the preceding 
  // onto the next, executes in order.
  // The second argument is the last function to execute, gets the cumulative
  // result of the preceding operations.
  series.series_on_result(s, render);

});

app.post('/auth', function(req, res) {
  var key = req.body.key;
  console.log("Supplied auth: " + key);
  cryptfile = './key1.crypt';

  clear_key = my_crypto.decrypt_phrase(key, cryptfile);
  console.log(clear_key);
  if (clear_key) {
    fs.unlink(cryptfile, function (err) {
      if (err) {
        throw err;
      }
      console.log("Deleted: " + cryptfile);
    });
    res.send("true");
  }
  else {
    bad_login();
    res.send("false");
  }
 
});


/*
 *
 *        Start the server
 *
 */

if (process.env.NODE_ENV == "production")
{
  var server = app.listen(process.env.PORT || 5000);
  console.log("Server started");
}
else
{
  var https = require('https');
  var privateKey  = fs.readFileSync('sslcert/backup_pass-key.pem');
  var certificate = fs.readFileSync('sslcert/public-cert.pem');
  var credentials = {key: privateKey, cert: certificate};
  var httpsServer = https.createServer(credentials, app);
  var server = httpsServer.listen(8443);
  console.log("Server started");
}
