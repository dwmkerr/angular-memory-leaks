var app = angular.module('app');

app.factory('ScenariosService', function($location, $q, ModalService) {

  //  Shows a message box with a title and message. Returns
  //  a promise resolve when the modal is closed.
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

  //  Transitions between each url in the array 'urls'. Repeats
  //  'times' with 'timesbetween' milliseconds between each navigation.
  //  Returns a promise resolved when the transition is complete.
  function transition(urls, times, timebetween) {

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

    var promise = $q.when();

    for(var i=0;i<times;i++) {
      for(var j=0; j<urls.length; j++) {
        promise = buildTransition(promise, urls[j], timebetween);
      }
    }

    return promise;
  }

  var scenario1 = function() {

    messageBox("Scenario 1", "Reloads the home page 20 times. Start Recording then press OK.")
      .then(function() {
        return transition(['/', '/nowhere'], 10, 500);
      })
      .then(function() {
        return messageBox("Scenario 1", "Stop Recording.");
      })
      .then(function() {
        //  done.
      });
  };

  var scenario2 = function() {

    messageBox("Scenario 2", "Moves between the home and top rated pages ten times. Start Recording then press OK.")
      .then(function() {
        return transition(['/', '/toprated'], 10, 500);
      })
      .then(function() {
        return messageBox("Scenario 2", "Stop Recording.");
      })
      .then(function() {
        //  done.
      });
  };

  return {
    scenario1: scenario1,
    scenario2: scenario2
  };

})