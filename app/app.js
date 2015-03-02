var app = angular.module('app', ['ngRoute', 'angularModalService']);

app.controller('HomeController', function($scope, $q, $location, ScenariosService) {

  $scope.isActive = function (viewLocation) { 
    return viewLocation === $location.path();
  };

  $scope.scenario1 = function() {
    ScenariosService.scenario1();
  };

  $scope.scenario2 = function() {
    ScenariosService.scenario2();
  };

  $scope.scenario3 = function() {
    ScenariosService.scenario3();
  };

})
.config(function($routeProvider) {
  $routeProvider
   .when('/album/:albumId', {
    templateUrl: 'app/album/album.html',
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
    templateUrl: 'app/toprated/toprated.html',
    controller: 'TopRatedController'
    }
  )
  .otherwise({
    templateUrl: 'app/albums/albums.html',
    controller: 'AlbumsController'
  });

});