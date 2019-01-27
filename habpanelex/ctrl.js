/*
    HPEx - (H)ab(P)anel(Ex)tension
    Extends HabPanel Functionality
    Lucky Mallari
    https://github.com/LuckyMallari/hpex

    MIT License

    Copyright (c) 2019 Lucky Mallari https://github.com/LuckyMallari/hpex

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.

*/
(function () {
    'use strict';

    // Polyfills
    (function hpexpolyfills() {
        if (!Element.prototype.matches) {
            Element.prototype.matches =
                Element.prototype.matchesSelector ||
                Element.prototype.mozMatchesSelector ||
                Element.prototype.msMatchesSelector ||
                Element.prototype.oMatchesSelector ||
                Element.prototype.webkitMatchesSelector ||
                function (s) {
                    var matches = (this.document || this.ownerDocument).querySelectorAll(s),
                        i = matches.length;
                    while (--i >= 0 && matches.item(i) !== this) { }
                    return i > -1;
                };
        }
    })();

    var app = angular.module('app', []);

    app.constant('DEFAULTCONFIG', {
        "initComplete": true,
        "isShowInDrawer": false,
        "screensaver": {
            "isEnabled": true,
            "timeoutSeconds": 120,
            "dashboardList": "",
            "durationSeconds": 10,
            "isFullScreen": true
        },
        "theaterMode": {
            "isEnabled": true,
            "isOn": false,
            "color": "rgba(0,0,0,0.90)",
            "triggeringItem": null
        }
    });
    app.service('HPExUtils', ['DEFAULTCONFIG',
        function (DEFAULTCONFIG) {

            var logTag = 'HPExUtils';
            var serviceApi = {};

            var log = function (s) { console.log(logTag + ": " + s); }

            var synchrounousRestCall = function (method, itemName, body, mime) {
                var xhr = new XMLHttpRequest();
                var url = '/rest/items/' + itemName;
                if ((method || "").toUpperCase() === 'GET') {
                    url += '?lucky=' + Math.random().toString().substring(2, 10) + 'charms'
                }
                xhr.open(method, url, false);
                mime = mime || "application/json";
                if ((method || "").toUpperCase() !== "GET")
                    xhr.setRequestHeader("Content-Type", mime);
                xhr.setRequestHeader("Accept", "application/json");
                xhr.send(body && JSON.stringify(body) || null);
                if (xhr.status !== 200 && xhr.status !== 201)
                    return {
                        status: xhr.status,
                        result: null
                    };
                return {
                    status: xhr.status,
                    result: xhr.responseText
                };
            }

            serviceApi.getConfig = function (id) {
                var c = synchrounousRestCall('GET', id);
                if (c == null || c.status !== 200) {
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
                try {
                    c = c && c.result && JSON.parse(c.result);
                } catch (e) {
                    c = "{}"
                }
                c = c.state;
                try {
                    c = JSON.parse(c);
                } catch (e) {
                    c = "{}";
                }
                if (c.initComplete) {
                    log("Config item found.")
                    return c;
                }

                log("Initializing Config.")
                c = DEFAULTCONFIG;
                c.initComplete = true;
                synchrounousRestCall('POST', id, c, "text/plain");
                log("Config init complete.")
                return c;
            }

            serviceApi.saveConfig = function (id, configData) {
                return synchrounousRestCall('POST', id, configData, "text/plain");
            }

            var getDom = function (d) {
                return typeof (d) === "object" ? d : document.querySelector(d);
            };

            serviceApi.hasParent = function (childSelector, parentSelector) {
                return serviceApi.findParent(childSelector, parentSelector) !== null;
            };

            serviceApi.findParent = function (childSelector, parentSelector) {
                var child = getDom(childSelector);
                return child && child.closest(parentSelector);
            };

            var init = function () { log("Init!"); return true; };

            serviceApi.init = init();

            return serviceApi;
        }


    ]);

    app.service('HPExService', ['$rootScope', '$location', 'OHService', 'HPExUtils', '$compile',
        function ($rootScope, $location, OHService, HPExUtils, $compile) {

            var logTag = 'HPExService';
            var serviceApi = {};

            var log = function (s) { console.log(logTag + ": " + s); }
            var protectedConfigData = HPExUtils.getConfig("habpanelExConfig");

            serviceApi.goToDashboard = function (name) {
                $location.url('/view/' + name);
            };

            serviceApi.saveConfig = function (newConfig) {
                protectedConfigData = newConfig;
                return HPExUtils.saveConfig("habpanelExConfig", newConfig);
            };

            serviceApi.getConfig = function () {
                return angular.copy(protectedConfigData);
            }

            serviceApi.toast = function (message) {

            };

            var init = function () {
                log("Init!");
                return true;
            };

            serviceApi.init = init(); 1
            return serviceApi;
        }
    ]);

    app.service('HPExScrSaverService', ['HPExService', '$rootScope', 'HPExUtils', '$interval', '$timeout', 'PersistenceService',
        function (HPExService, $rootScope, HPExUtils, $interval, $timeout, PersistenceService) {
            var logTag = 'HPExScrSaverService';
            var log = function (s) { console.log(logTag + ": " + s); }
            var serviceApi = {};
            var eventsList = ["mousemove", "keyup", "keydown", "click"];
            var timers = {
                idleTimer: null,
                screenSaverTimer: null
            }
            var config = {};
            var currentIndex = 0;

            serviceApi.getAvailablePanelIds = function () {
                return extractIds(PersistenceService.getDashboards()).join(', ');
            }

            var resetTimer = function () {
                stopIdleTimer();
                startIdleTimer();
            };

            var idleHit = function () {
                var interval = config.durationSeconds || 10;
                timers.screenSaverTimer = $interval(next, interval * 1000);
            }

            var next = function () {
                var nextDb = config.dashboardList[currentIndex];
                HPExService.goToDashboard(nextDb);
                if (currentIndex == config.dashboardList.length - 1)
                    currentIndex = 0;
                else
                    currentIndex++;
            };

            var startIdleTimer = function () {
                var timeout = config.timeoutSeconds || 300;
                timers.idleTimer = $timeout(idleHit, timeout * 1000);
            };

            var stopIdleTimer = function () {
                $timeout.cancel(timers.idleTimer);
                $interval.cancel(timers.screenSaverTimer);
                timers.idleTime = null;
                timers.screenSaverTimer = null;
            };

            var listen = function () {
                for (var i = 0; i < eventsList.length; i++) {
                    var e = eventsList[i];
                    document.addEventListener(e, resetTimer);
                }
            };

            var unlisten = function () {
                for (var i = 0; i < eventsList.length; i++) {
                    var e = eventsList[i];
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

                for (var i = 0; i < a.length; i++) {
                    var d = a[i];
                    d.id && d.id !== "HabPanelEx" && l.push(d.id);
                }
                return l;
            }

            var initConfig = function () {
                config = angular.copy(HPExService.getConfig());
                config = config && config.screensaver || {};
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
                    stopIdleTimer();
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

                var found = HPExUtils.findParent('.hpex-drawer', 'li');

                if (found) {
                    if ($scope.config.isShowInDrawer) {
                        found.style.display = "block";
                        return;
                    }
                    found.style.display = "none";
                }
                return !!found;
            };

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

    app.service('HPExModalService', ['$uibModal',
        function ($uibModal) {
            var serviceApi = {};

            var bucket = { modalInstance: null };
            serviceApi.open = function (title, message) {
                bucket.modalInstance = $uibModal.open({
                    templateUrl: '/static/habpanelex/tpl/modal.html?lucky=' + Math.random().toString().substring(2, 7),
                    backdrop: 'static',
                    controller: function ($scope, $uibModalInstance) {
                        $scope.close = $uibModalInstance.close;
                        $scope.title = title;
                        $scope.message = message;
                    }
                })
            };
            serviceApi.close = function () {
                bucket.modalInstance.close();
            };
            return serviceApi;
        }
    ]);


    /*
        Main Settings Controller
    */
    app.controller('HPExCtrl', ['$scope', 'HPExService', 'HPExUtils', '$rootScope', 'HPExScrSaverService', 'HPExModalService',
        function ($scope, HPExService, HPExUtils, $rootScope, HPExScrSaverService, HPExModalService) {
            var logTag = 'HPExCtrl';
            $scope.header = "HPEx";

            $scope.availablePanelIds = HPExScrSaverService.getAvailablePanelIds();

            $scope.instanceId = Math.random().toString(36).substring(2);

            $scope.isDrawer = function () {
                var retVal = HPExUtils.hasParent('.hpex-main_' + $scope.instanceId, '.drawer');
                return retVal;
            };

            $scope.saveConfig = function () {
                var r = HPExService.saveConfig($scope.config);
                if (r.status === 201 || r.status === 200) {
                    $rootScope.$broadcast('HPExEvent.configChanged');
                    HPExModalService.open('Config', 'Saved');
                }
                else {
                    HPExModalService.open('Config', 'Failed');
                }

            }

            $scope.cancelConfig = function () {
                onInit();
                HPExModalService.open('Config', 'Canceled');
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
        }
    ]);

    app.service('HPExFSService', ['$rootScope', 'HPExService',
        function ($rootScope, HPExService) {
            var logTag = 'HPExFSService';
            var serviceApi = {};
            var config = {};

            var onConfigChanged = function () {
                config = HPExService.getConfig();
            };

            var log = function (s) { console.log(logTag + ": " + s); }

            var onInit = function () {
                config = HPExService.getConfig();
                log("Init");
            };

            serviceApi.startTheaterMode = function () {
                var el = document.getElementById('theaterModeMainEl');
                el && (el.style.display = "block");
            };

            serviceApi.stopTheaterMode = function () {
                var el = document.getElementById('theaterModeMainEl');
                el && (el.style.display = "none");
            };

            serviceApi.toggleTheaterMode = function () {
                var el = document.getElementById('theaterModeMainEl');
                var d = el && el.style.display;
                if (d) {
                    el.style.display = el.style.display == "none" ? "block" : "none";
                }
            };

            $rootScope.$on('HPExEvent.configChanged', onConfigChanged);
            onInit();

            return serviceApi;
        }
    ]);

    app.controller('HPExTheaterCtrl', ['$scope', 'HPExFSService',
        function ($scope, HPExFSService) {
            $scope.on = function () {
                HPExFSService.startTheaterMode();
            };
            $scope.off = function () {
                HPExFSService.stopTheaterMode();
            };
            $scope.toggle = function () {
                HPExFSService.toggleTheaterMode();
            };
        }
    ]);

    app.directive('habPanelEx', function () {
        return {
            templateUrl: '/static/habpanelex/tpl/main.html?lucky=' + Math.random().toString().substring(2, 7),
            restrict: 'A',
            controller: 'HPExCtrl',
            scope: false
        };
    });
})();