angular.module('app')
.controller('AlbumController', function($scope, album) {

  function AlbumControllerTag() {}
  $scope.__tag = new AlbumControllerTag();

  $scope.title = album.name;
  $scope.pictures = album.pictures;

  $scope.$on('$something', function() {

    $scope.test = "result";

  });

})
.directive('amlPicture', function() {
  return {
    restrict: "E",
    scope: {
      picture: "=",
      title: "="
    },
    link: function(scope, element, attr) {
      element.popover({
        title: function() {
          return scope.title;
        },
        content: "Do you like this picture?"
      });
    },
    template: 
      '<img ng-attr-src="{{picture}}" class="img-thumbnail" width="300">'
  };
});