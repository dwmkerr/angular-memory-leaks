var summat = [];

angular.module('app')
.controller('TopRatedController', function($scope, $http) {

  var refresh = function() {

    $http.get('/api/toprated').success(function(albums) {

      $scope.albums = albums;

    });

  };

  $scope.refresh = refresh;

  refresh();

  summat.push(refresh);

})
.directive('amlRefreshButton', function() {
  return {
    restrict: "E",
    scope: {
      onRefresh: "="
    },
    link: function(scope, element, attr) {
      element.on('click', function() {
        if(scope.onRefresh) {
          scope.onRefresh();
        }
      })
    },
    template: '<span class="glyphicon glyphicon-refresh" aria-hidden="true"></span>'
  };
});