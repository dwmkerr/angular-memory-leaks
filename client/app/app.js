var app = angular.module('app', ['ngRoute', 'angularModalService']);

app.controller('HomeController', function($scope, $q, $location, ModalService) {


    function messageBox(title, message) {
      var deferred = $q.defer();

      ModalService.showModal({
        templateUrl: "app/popup/popup.html",
        controller: "PopupController",
        inputs: {
          data: {
            title: title,
            message: message
          }
        }
        }).then(function(modal) {
          modal.element.modal();
          return modal.close.then(function(result) {
            deferred.resolve();
          });
        });

      return deferred.promise;
    }

    $scope.test2 = function() {
      messageBox("Test 2", "This shouldn't leak BABY.");
    };

  $scope.test1 = function() {

    function buildTransition(promise, url, wait) { 
      var deferred = $q.defer();
      
      promise.then(function() {

        $location.path(url);
        setTimeout(function() {
          deferred.resolve();
        }, wait);

        return deferred.promise;

      });

      return deferred.promise;
    }

    function transition(urls, times, timebetween) {
      var promise = $q.when();

      for(var i=0;i<times;i++) {
        for(var j=0; j<urls.length; j++) {
          promise = buildTransition(promise, urls[j], timebetween);
        }
      }

      return promise;
    }

    messageBox("Test 1", "Start Recording")
      .then(function() {
        return transition(['/', '/albums'], 100, 100);
      })
      .then(function() {
        return messageBox("Test 1", "Stop Recording");
      })
      .then(function() {
        //  done.
      });

  };

})
.config(function($routeProvider) {
  $routeProvider
   .when('/album/:albumId', {
    templateUrl: '/app/album/album.html',
    controller: 'AlbumController',
    resolve: {
      album: function($http, $route) {
        console.log(JSON.stringify($route.current.params));
        return $http.get('/api/album/' + $route.current.params.albumId)
          .then(function(response) {
            return response.data;
          });
      }
    }
  })
   .when('/toprated', {
    templateUrl: '/app/toprated/toprated.html',
    controller: 'TopRatedController'
    }
  )
  .otherwise({
    templateUrl: '/app/albums/albums.html',
    controller: 'AlbumsController'
  });

});