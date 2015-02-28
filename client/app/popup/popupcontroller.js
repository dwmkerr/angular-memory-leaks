var app = angular.module('app');

app.controller('PopupController', function($scope, data, close) {

  function PopupControllerTag() {}
  $scope.__tag = new PopupControllerTag();
  
  $scope.title = data.title;
  $scope.message = data.message;

 $scope.close = function(result) {
  close(result, 500); // close, but give 500ms for bootstrap to animate
 };

});