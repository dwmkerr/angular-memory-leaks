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

  var scenariosService = {};

  scenariosService.scenario1 = function() {

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

  scenariosService.scenario2 = function() {

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

  scenariosService.scenario3 = function() {

    messageBox("Scenario 3", "When you press OK some basic data will be allocated.")
      .then(function() {

      //  Create a class which will hold heap data. Makes it easier 
      //  to find the data in Chrome.
      function HeapData() {}

      //  Create a heap data object.
      var heapData = new HeapData();

      //  Create a function that multiplies two numbers.
      function multiply(a, b) {
        return a * b;
      }

      //  Create a 'multiply by' function, which curries the above
      //  to generate a function which multiplies by a constant. This
      //  will involve closures. 
      var multiplyBy = function(a) {
        return function(b) {
          return multiply(a, b); 
        }
      };

      //  Add some data to our heap data object.
      heapData.fry = "Philip J. Fry";
      heapData.zoidberb = "John " + "Zoidberg";
      heapData.character = {
        firstName: "Amy",
        secondName: "Wong"
      };
      heapData.double = multiplyBy(2);
      heapData.multiplyBy100 = multiplyBy(100);
      heapData.doubledNumber = heapData.double(18);
      heapData.multipliedNumber = heapData.multiplyBy100(15);
      heapData.div = document.createElement("div");

      //  Put the heap data on the window, it is now pinned to a GC root.
      window.heapData = heapData;

      messageBox("Scenario 3", "Done.");

    });

  };

  scenariosService.scenario4 = function() {

    messageBox("Scenario 4", "Moves between the home and India album page times. Start Recording then press OK.")
      .then(function() {
        return transition(['/', '/album/1'], 10, 500);
      })
      .then(function() {
        return messageBox("Scenario 4", "Stop Recording.");
      })
      .then(function() {
        //  done.
      });
  };

  return scenariosService;

})