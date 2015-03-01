angular.module('app')
.controller('TopRatedController', function($scope, $http, $interval) {

  var refresh = function() {

    $http.get('/api/toprated').success(function(albums) {

      $scope.albums = albums;

    }).then(function() {

      $interval(function() {

        $http.get('/api/toprated').success(function(albums) {
          $scope.albums = albums;
        });

      }, 10000);

    });

  };

  $scope.refresh = refresh;

  refresh();

})
.directive('amlRatedAlbum', function() {
  return {
    restrict: "E",
    scope: {
      album: "="
    },
    link: function(scope, element, attr) {
      element.tooltip({
        title: function() {
          return "Rating is " + scope.title;
        }
      });
    },
    template: 
      '<a ng-href="#/album/{{album._id}}"><h4>{{album.name}}</h4></a>' +
      '   <a ng-href="#/album/{{album._id}}">' +
      '   <img ng-attr-src="{{album.cover}}" class="img-thumbnail" width="500">' +
      '</a>'
  };
});