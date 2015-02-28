var express = require('express');
var app = express();
var path = require('path');
var fs = require('fs');



module.exports.startServer = function() {

  fs.readFile( __dirname + '/albums.json', function (err, data) {
    if (err) {
      throw err; 
    }

    var albums = JSON.parse(data);

    //  Serve the client.
    app.use(require('connect-livereload')());
    app.use(express.static(path.join(__dirname, '../client')));

    app.get('/api/albums', function(req, res) {

      res.send(albums);

    });
    
    app.get('/api/toprated', function(req, res) {

      res.send(albums);

    });

    app.get('/api/album/:albumId', function(req, res) {

      for(var i=0;i<albums.length;i++) {
        res.send(albums[i]);
        return;
      }
      res.send(404);


    });

    //  Serve APIs.
    app.listen(3000);
    console.log('Rocking port 3000');
  
  });
};