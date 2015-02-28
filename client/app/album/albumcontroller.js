angular.module('app')
.controller('AlbumController', function($scope, album) {

  function AlbumControllerTag() {}
  $scope.__tag = new AlbumControllerTag();

  $scope.title = album.name;
  $scope.pictures = album.pictures;

});