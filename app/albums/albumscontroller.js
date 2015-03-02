angular.module('app')
.controller('AlbumsController', function($scope, $http) {

  function AlbumsControllerTag() {}
  $scope.__tag = new AlbumsControllerTag();

  $http.get('/api/albums').success(function(albums) {

    $scope.albums = albums;

  });

});