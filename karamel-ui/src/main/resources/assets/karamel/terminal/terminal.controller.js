'use strict';

angular.module('main.module')

  .controller('terminal.controller', ['$log', '$rootScope', '$scope',
    '$interval', '$timeout', 'core-rest.service',
    function($log, $rootScope, $scope, $interval, $timeout, coreService) {

      function initScope(scope) {
        scope.commandObj = [];
        scope.intervalInstance = [];
        scope.timeoutInstance = [];
        for (var i = 0; i < 3; i++) {
          scope.commandObj.push({
            commandName: null,
            commandResult: null,
            renderer: 'info',
            menuitems: [{command: "home", label: 'Home'}, {command: "new", label: 'New Cluster'}, {command: "help", label: 'Help'}]
          });
          scope.intervalInstance.push(undefined);
          scope.timeoutInstance.push(undefined);
        }

        // Register a destroy event.
        scope.$on('$destroy', function() {
          _destroyIntervalInstances();
        });

        scope.htmlSafeData = undefined;
        scope.dagData = undefined;
//        scope.processCommand(0, "home");
        scope.processCommand(0, "running");
      }

      $scope.htmlsafe = function(index) {

        $log.info('Called html safe');
        var text = $scope.commandObj[index].commandResult;

        var htmlize = function(str) {
          if (str !== null) {
            return str
              .replace(/&/g, '&amp;')
              .replace(/ /g, '&nbsp;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#39;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(new RegExp('\r?\n', 'g'), '<br/>');
          } else
            return "";
        };

        var convertLinks = function(str) {
          if (str !== null) {
            var pattern = new RegExp(/kref='((\w|[-]|\.|\s)*)'/g);
            var match;
            var lastInx = -1;
            var newStr = "";
            while (match = pattern.exec(str)) {

              if (lastInx < match.index) {
                newStr = newStr + str.substring(lastInx, match.index);
              }
              lastInx = pattern.lastIndex;
              newStr = newStr + "ng-click=\"processCommand(0, \'" + match[1] + "\')\"";
            }

            if (str !== null && lastInx < str.length) {
              newStr = newStr + str.substring(lastInx, str.length);
            }

            return newStr;
          } else
            return "";
        };

        text = convertLinks(text);

        var pattern = new RegExp(/<a[^>]*>[^<>]*<\/a>/g);
        var match;
        var lastInx = -1;
        var newStr = "";
        while (match = pattern.exec(text)) {
          if (lastInx < match.index) {
            newStr = newStr + htmlize(text.substring(lastInx, match.index));
          }
          lastInx = pattern.lastIndex;
          newStr = newStr + match[0];
        }

        if (text !== null && lastInx < text.length) {
          newStr = newStr + htmlize(text.substring(lastInx, text.length));
        }

        newStr = "<div>" + newStr + "</div>";
        $scope.htmlSafeData = newStr;
      };

      $scope.processTerminal = function(index) {
        _destroyIntervalInstance(index);
        var commandName = $scope.commandObj[index].commandName;
        var commandArg = $scope.commandObj[index].commandResult;
        $scope.commandObj[index].commandName = null;
        $scope.$emit('ask-core', {index: index, cmdName: commandName, cmdArg: commandArg});
      };

      $scope.processCommand = function(index, cmdName) {
        $log.debug("Process Command Called");
        var commandArg = null;
        if ($scope.commandObj[index].renderer === 'yaml')
          commandArg = $scope.commandObj[index].commandResult;
        _destroyIntervalInstance(index);
        $scope.$emit('ask-core', {index: index, cmdName: cmdName, cmdArg: commandArg});
      };

      $scope.$on('ask-core', function(e, input) {
        var index = input.index;
        var cmdName = input.cmdName;
        var cmdArg = input.cmdArg;
        $log.info("Running " + cmdName);

        var obj = {
          command: cmdName,
          result: cmdArg
        };

        coreService.processCommand(obj)

          .success(function(data) {
            $scope.commandObj[index].errormsg = data.errormsg;

            if (data.errormsg === null) {
              $rootScope.context = data.context;
              $scope.commandObj[index].successmsg = data.successmsg;
              var timeinterval = 5000;

              if (data.successmsg === null) {
                $scope.commandObj[index].commandResult = data.result;
                if (data.renderer !== null) {
                  $scope.commandObj[index].renderer = data.renderer;
                } else {
                  $scope.commandObj[index].renderer = 'info';
                }
                if (data.renderer === 'info') {
                  $scope.htmlsafe(index);
                } else if (data.renderer === 'dag') {
                  $scope.dagData = data.result;
                } else if (data.renderer === 'ssh') {
                  _destroyIntervalInstance(index);
                  $scope.$emit('core-result-ssh', {result: data.result, context: data.context});
                }
              } else {
                timeinterval = 5000;
              }

              if (data.nextCmd !== null) {
                _destroyIntervalInstance(index);
                $scope.timeoutInstance[index] = $timeout(function() {
                  $scope.$emit('ask-core', {index: index, cmdName: data.nextCmd, cmdArg: null});
                }, timeinterval);
              }

            }

            if (data.menuItems.length > 0) {
              $scope.commandObj[index].menuitems = data.menuItems;
            }
          })
          .error(function(data) {
            $log.info('Core -> Unable to process command: ' + cmdName);
            // Turn text Red and write error message at the board cluster name
            // http://stackoverflow.com/questions/27030849/change-font-color-of-text-in-scope-variable-in-angularjs
//            $rootScope.headerName = "Karamel Application has Crashed. Restart it.";
            $rootScope.activeCluster.name = "Karamel Application has Crashed. Restart it.";
//            $rootScope.activeCluster.name = $interpolate('<font color="red">{{headerName}}</font>')($rootScope);      
          });
      });


      /**
       * If any interval instances are present, destroy them.
       * Helps to prevent any memory leaks in the system.
       * @private
       */
      function _destroyIntervalInstances() {
        for (var i = 0, len = $scope.intervalInstance.length; i < len; i++) {
          _destroyIntervalInstance(i);
        }
      }

      function _destroyIntervalInstance(index) {
        if (angular.isDefined($scope.intervalInstance[index])) {
          $interval.cancel($scope.intervalInstance[index]);
        }
        if (angular.isDefined($scope.timeoutInstance[index])) {
          $timeout.cancel($scope.timeoutInstance[index]);
        }
      }

      initScope($scope);
    }]);

