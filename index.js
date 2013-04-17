var EventSource = require('eventsource');
var async = require('async');
var request = require('request');

var host = 'http://localhost:5984';
var path = '/_changes?feed=eventsource&timeout=5000'

// these dbs will be deleted, created, and loaded with the docs below.
var dbnames = ['source1'];

// docs with these id's get loaded into above db's.
var docnames = ['one', 'two', 'three'];

function postDoc (opts, cb) {
  var dbname = opts[0];
  var id = opts[1];
  request.post(
    { uri: [host, dbname].join('/')
    , body: {_id: id}
    , json: true
    }
    , function (er, res, body) {
        if (er) return cb(er);
        cb(null, body);
      }
  );
}

function setupdb (dbname, done) {
  async.series(
    [ function del (cb) {
        request.del([host, dbname].join('/'), function (er, res, body) {
          cb();
        })
      }
    , function create (cb) {
        request.put([host, dbname].join('/'), function (er, res, body) {
          cb();
        })
      }
    , function load (cb) {
        async.map(
            docnames.map(function (id) {
              return [dbname, id];
            })
          , postDoc
          , function (er, res) {
              if (er) return cb(er);
              cb(null, res);
          }
        )
      }
    ]
    , function (er, res) {
        if (er) return done(er);
        done(null, res);
      }
  )
}

function dateString(d){
  function pad(n){return n<10 ? '0'+n : n}
  return pad(d.getUTCHours())+':'
      + pad(d.getUTCMinutes())+':'
      + pad(d.getUTCSeconds())+'Z'
}

function log (msg) {
  var d = new Date();
  console.log(dateString(d)+' -- '+msg);
}

function createSource (dbname, onMessage) {
  var s = new EventSource([host, dbname, path].join('/'));
  s.onmessage = onMessage;
  return s;
}


log('start');

/*
  1) delete any test databases defined by `dbnames`
  2) created databases defined by `dbnames`
  3) load docs into dbs
  4) start eventsource feeds for each db.
 */
async.map(dbnames, setupdb, function (er,res) {
  if (er) console.log(er);

  dbnames.forEach(function (dbname) {
    createSource(dbname, function (e) {
      log(dbname+': '+JSON.stringify(e.data));
    });
  });
})


