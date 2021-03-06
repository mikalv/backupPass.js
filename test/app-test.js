/*global describe, it, before, after */

var request = require('supertest');
var should = require('should');
var fs = require('fs');
var path = require('path');
var getToken = require('./getToken');


//request = request('http://localhost:8000');
process.env.NODE_ENV = 'test';
process.env.KEEPASS_PATH = './testing_db.kdbx';
process.env.LOG_LEVEL = 'quiet';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
process.env.USE_TWILIO = false;


var basepath = __dirname;

var copyfile = function(file) {
  var basename = path.basename(file);
  var filepath = basepath + '/data/keys/' + file;
  try {
    fs.writeFileSync(basepath + '/../testing/' + basename, fs.readFileSync(filepath));
  } catch (err) {
    throw err;
  }
};

var app;
var successAgent;
var failAgent;


before(function(done) {
  this.timeout(4000);
  // Delete a lockfile if it exists
  try {
    fs.unlinkSync(basepath + '/../lockfile');
  } catch (err) {
  }

  // Must start app after lockfile has been deleted
  app = require('../app.js');
  successAgent = request.agent(app);
  failAgent = request.agent(app);

  // Make the ./testing directory if it doesn't exist
  try {
    fs.mkdirSync(basepath + '/../testing');
  } catch (err) {
    if (err.code != "EEXIST") throw err;
  }

  fs.readdir(basepath + '/data/keys', function(err, files) {
    files.forEach(copyfile);

    try {
      fs.writeFileSync(basepath + '/../testing_db.kdbx', fs.readFileSync(basepath + '/data/testing_db.kdbx'));
    done();
    } catch (err) {
      throw err;
    }

  });

});

describe('index', function() {
  it('should return 200', function(done) {
    successAgent
    .get('/')
    .expect(200)
    .end(function(err,res) {
      should.not.exist(err);
      done();
    });
  });
});

describe('authenticate with valid key', function() {
  var sessKey

  it('should should return true and a sessKey', function(done) {
    successAgent
    .post('/auth')
    .send({ key: '245871dde31a9fb81f76745f279b6b161501b8e41c1ad05fa88f65481d19f2c4' })
    .expect('Content-Type', /json/)
    .expect(200)
    .end(function(err, res) {
      if (err) return done(err)
      res.body.sessKey.should.be.ok
      res.body.response.should.equal.true
      sessKey = res.body.sessKey
      done();
    });
  });

  describe('login with valid password', function() {
    it('Should return an array with a correct password', function(done) {
      successAgent
      .post('/secure/list')
      .send({ pass: 'a test', sessKey: sessKey })
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);
        res.body.should.be.instanceof(Array);
        done();
      });
    });

    it('should return an account object when given an index', function(done) {
      successAgent
      .post('/secure/show')
      .send({ index: 1, sessKey: sessKey})
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);
        res.body.should.be.instanceof(Object);
        res.body.username.should.be.instanceof(String);
        res.body.password.should.be.instanceof(String);
        res.body.notes.should.be.instanceof(String);
        done();
      });
    });

    it('should not allow repeated account access', function(done) {
      successAgent
      .post('/secure/show')
      .send({ index: 2, sessKey: sessKey})
      .expect(403)
      .end(function(err, res) {
        res.body.error.should.equal("Invalid session")
        done()
      });
    });
  });
});

describe('authenticate with invalid key', function() {

  it('should return 401 with invalid key', function(done) {
    failAgent
    .post('/auth')
    .send({ key: 'incorrect key' })
    .expect(401, done);
  });

  it('should return false with a repeated key', function(done) {
    failAgent
    .post('/auth')
    .send({ key: '245871dde31a9fb81f76745f279b6b161501b8e41c1ad05fa88f65481d19f2c4' })
    .expect(401, done);
  });

  
  it('should delete all key files after three failed login attempts', function(done) {
    // One more bad login required first
    failAgent
    .post('/auth')
    .send({ key: 'invalid key' })
    .end(function() {
      var path = basepath + '/../testing/';
      var getFiles = function() {
        fs.readdir(path, function(err, files) {
          files.length.should.equal(0);
          done();
        });
      };
      // Wait for server unlink to finish... cludge
      setTimeout(getFiles, 300);
    });
  });

  it('should delete kdbx database after three failed logins', function(done) {
    var path = basepath + '/../testing_db.kdbx';
    fs.exists(path, function(exists) {
      exists.should.equal(false);
      done();
    });
  });

});

describe('Sessions should be secure', function() {

  it.skip('should fail with an incorrect sessKey', function(done) {
    failAgent
    .post('/auth')
    .send({ key: 'cde94152fe008cce8ce9d42b3964fc55c3eebbab2c9e3079af0f82735c4d0de0' })
    .end();

    failAgent
    .post('/secure/list')
    .send({ pass: 'a test' })
    .expect(403, done);
  });

  // Need to implement this later
  it.skip('should fail with an invalid cookie', function(done) {
  });
});


describe('Authenticate with incorrect password', function() {
  var sessKey

  before(function(done) {
    // Make sure to delete the lockfile if it exists
    try {
      fs.unlinkSync(basepath + '/lockfile');
    } catch (err) {
    }

    // Need to replace testing.kdbx file
    try {
      fs.writeFileSync(basepath + '/../testing_db.kdbx', fs.readFileSync(basepath + '/data/testing_db.kdbx'));
    } catch (err) {
      throw err;
    }

    // Restart server since it locked during the last tests...
    console.log("Restarting server...");
    app.restart();
    failAgent = request.agent(app);

    // Need to suppy a valid key before each password test
    // Make sure to wait through timeout from last bad login
    copyfile('key0.crypt');
    var authWithKey = function (err, token) {
      failAgent
      .post('/auth')
      .send({ key: '245871dde31a9fb81f76745f279b6b161501b8e41c1ad05fa88f65481d19f2c4' })
      .end(function(err, res) {
        sessKey = res.body.sessKey
        done();
      });
    };

    getToken(failAgent, authWithKey);
  });

  it('Should return an 401 with an incorrect password', function(done) {
    failAgent
    .post('/secure/list')
    .send({ pass: 'incorrect password' , sessKey: sessKey})
    .expect('Content-Type', /json/)
    .expect(401, done);
  });

});

after(function(done) {
  var testdb = basepath + '/../testing_db.kdbx';
  fs.unlink(testdb, function(err) {
    // Don't throw an error if file doesn't exist
    if (err) {
      if (err.code != 'ENOENT') throw err;
    }
    done();
  });
});
