angular.module('app')
.controller('TopRatedController', function($scope, $http) {

  $http.get('/api/toprated').success(function(albums) {

    $scope.albums = albums;

  });

});