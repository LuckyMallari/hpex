/*
    HPEx - (H)ab(P)anel(Ex)tension
    Extends HabPanel Functionality
    Lucky Mallari
*/
(function () {
    'use strict';
    var app = angular.module('app', []);

    app.service('HPExUtils', [
        function () {

            var logTag = 'HPExUtils';
            var serviceApi = {};

            var log = function (s) { console.log(logTag + ": " + s); }

            var synchrounousRestCall = function (method, itemName, body, mime) {
                var xhr = new XMLHttpRequest();
                xhr.open(method, '/rest/items/' + itemName, false);
                mime = mime || "application/json";
                if ((method || "").toUpperCase() !== "GET")
                    xhr.setRequestHeader("Content-Type", mime);
                xhr.setRequestHeader("Accept", "application/json");
                xhr.send(body && JSON.stringify(body) || null);
                if (xhr.status !== 200 && xhr.status !== 201)
                    return null;
                return xhr.responseText;
            }

            serviceApi.getConfig = function (id) {
                var c = synchrounousRestCall('GET', id);
                if (c == null) {
                    // Config does not exist. Create an item for it.
                    log("Config item does not exist. Creating one..")
                    var data = {
                        "type": "String",
                        "name": id,
                        "label": "HPEx Config for " + id
                    };

                    var d = synchrounousRestCall('PUT', id, data);
                    // Then retrieve it
                    c = synchrounousRestCall('GET', id);
                }
                c = c && JSON.parse(c);
                c = c.state;
                if (c && c === "NULL") {
                    c = "{}";
                }
                c = JSON.parse(c);
                if (c.initComplete) {
                    log("Config item found.")
                    return c;
                }

                log("Initializing Config.")
                c.initComplete = true;
                synchrounousRestCall('POST', id, c, "text/plain");
                log("Config init complete.")
                return c;
            }

            serviceApi.saveConfig = function (id, configData) {
                return synchrounousRestCall('POST', id, configData, "text/plain");
            }

            serviceApi.hasParent = function (childSelector, parentSelector) {
                var child = document.querySelector(childSelector);
                var parent = document.querySelector(parentSelector);
                return parent.contains(child);
            }

            serviceApi.findParent = function (childSelector, parentSelector) {
                var child = document.querySelector(childSelector);
                if (!child)
                    return false;
                var parent = child.parentNode;
                while (true) {
                    if (parent.matches(parentSelector)) break;
                    if (parent.matches(parentSelector)) break;
                    parent = parent.parentNode;
                }
                if (parent.matches('body')) parent = null;
                return parent;
            };

            var init = function () { log("Init!"); return true; };

            serviceApi.init = init();

            return serviceApi;
        }


    ]);

    app.service('HPExService', ['$rootScope', '$location', 'OHService', 'HPExUtils',
        function ($rootScope, $location, OHService, HPExUtils) {
            var logTag = 'HPExService';
            var serviceApi = {};

            var log = function (s) { console.log(logTag + ": " + s); }
            var protectedConfigData = HPExUtils.getConfig("habpanelExConfig");

            serviceApi.goToDashboard = function (name) {
                $location.url('/view/' + name);
            };

            serviceApi.saveConfig = function (newConfig) {
                protectedConfigData = newConfig;
                HPExUtils.saveConfig("habpanelExConfig", newConfig);
            };

            serviceApi.getConfig = function () {
                return angular.copy(protectedConfigData);
            }

            var init = function () {
                log("Init!");
                return true;
            };

            serviceApi.init = init();1
            return serviceApi;
        }
    ]);

    app.service('HPExScrSaverService', ['HPExService', '$rootScope', 'HPExUtils', '$interval', 'PersistenceService',
        function (HPExService, $rootScope, HPExUtils, $interval, PersistenceService) {
            var logTag = 'HPExScrSaverService';
            var log = function (s) { console.log(logTag + ": " + s); }
            var serviceApi = {};
            var eventsList = ["mousemove", "keyup", "keydown", "click"];
            var timer = null;
            var config = {};
            var currentIndex = 0;

            serviceApi.getAvailablePanelIds = function () {
                return extractIds(PersistenceService.getDashboards()).join(', ');
            }

            var resetTimer = function () {
                stopTimer();
                startTimer();
                log("Idle reset.");
            };

            var next = function () {
                var nextDb = config.dashboardList[currentIndex];
                console.log('next: ' + nextDb);
                HPExService.goToDashboard(nextDb);
                if (currentIndex == config.dashboardList.length - 1)
                    currentIndex = 0;
                else
                    currentIndex++;
            };

            var startTimer = function () {
                var timeout = config.timeoutSeconds || 10;
                timer = $interval(next, timeout * 1000);
            };

            var stopTimer = function () {
                $interval.cancel(timer);
                timer = null;
            };

            var listen = function () {
                for (var e of eventsList) {
                    document.addEventListener(e, resetTimer);
                }
            };

            var unlisten = function () {
                for (var e of eventsList) {
                    document.removeEventListener(e, resetTimer);
                }
            };

            var extractIds = function (a) {
                var l = [];
                if (!Array.isArray(a)) {
                    if (typeof (a) === "string") {
                        return a.split(",");
                    } else {
                        return null;
                    }
                }
                
                for (var d of a) {
                    d.id && d.id !== "HabPanelEx" && l.push(d.id);
                }
                return l;
            }

            var initConfig = function () {
                config = angular.copy(HPExService.getConfig());
                config = config.screensaver;
                if (!config.dashboardList) {
                    config.dashboardList = PersistenceService.getDashboards();
                }
                config.dashboardList = extractIds(config.dashboardList);
            };

            var ssMain = function () {
                if (config.isEnabled) {
                    listen();
                    resetTimer();
                } else {
                    unlisten();
                    stopTimer();
                }
            };

            var onConfigChanged = function () {
                initConfig();
                ssMain();
            };

            var onInit = function () {
                initConfig();
                ssMain();
                log("Init");
            };

            $rootScope.$on('HPExEvent.configChanged', onConfigChanged);
            onInit();

            return serviceApi;
        }
    ]);

    app.controller('HPExDrawerCtrl', ['$scope', 'HPExService', '$rootScope', 'HPExUtils', 'HPExScrSaverService',
        function ($scope, HPExService, $rootScope, HPExUtils, HPExScrSaverService) {
            var logTag = 'HPExDrawerCtrl';
            var log = function (s) { console.log(logTag + ": " + s); }

            var onDestroy = function () {
                log("Destroyed!");
            };

            var showOrHide = function () {
                var found = HPExUtils.findParent('.hpex-main_' + $scope.rnd, 'li');
                found && (found.style.display = $scope.config.isShowInDrawer ? "block" : "none");
            }

            var onInit = function () {
                log("Init");
                $scope.config = HPExService.getConfig();
                showOrHide();
            };


            $rootScope.$on('HPExEvent.configChanged', onInit);
            $scope.$on('$destroy', onDestroy);
            onInit();
        }]
    );

    /*
        Main Settings Controller
    */
    app.controller('HPExCtrl', ['$scope', 'HPExService', 'HPExUtils', '$rootScope', 'HPExScrSaverService',
        function ($scope, HPExService, HPExUtils, $rootScope, HPExScrSaverService) {
            var logTag = 'HPExCtrl';
            $scope.header = "HPEx";

            $scope.availablePanelIds = HPExScrSaverService.getAvailablePanelIds();

            $scope.rnd = Math.random().toString(36).substring(2);

            $scope.isDrawer = function () {
                var retVal = HPExUtils.hasParent('.hpex-main_' + $scope.rnd, '.drawer');
                return retVal;
            };

            $scope.saveConfig = function () {
                HPExService.saveConfig($scope.config);
                $rootScope.$broadcast('HPExEvent.configChanged');
            }

            $scope.cancelConfig = function () {
                onInit();
            }

            var log = function (s) { console.log(logTag + ": " + s); }

            var onInit = function () {
                $scope.config = HPExService.getConfig();
                log("Init");
            };

            var onDestroy = function () {
                log("Destroyed!");
            };

            $scope.$on('$destroy', onDestroy);
            onInit();
        }]
    );
})();