'use strict';

/* App Module */

var actplan = angular.module('actplan',
        ['ui.bootstrap',
         'ngRoute',
         'ngCookies',
         'ngSanitize',
         'ngMessages',
         'actplanServices',
         'actplanFilters',
         'actplanDirectives',
         'd2Directives',
         'd2Filters',
         'd2Services',
         'd2Controllers',
         'angularLocalStorage',
         'ui.select',
         'ui.select2',
         'pascalprecht.translate'])

.value('DHIS2URL', '../api')

.config(function($httpProvider, $routeProvider, $translateProvider) {

    $httpProvider.defaults.useXDomain = true;
    delete $httpProvider.defaults.headers.common['X-Requested-With'];

    $routeProvider.when('/home', {
        templateUrl:'components/home/home.html',
        controller: 'HomeController'
    }).otherwise({
        redirectTo : '/home'
    });

    $translateProvider.preferredLanguage('en');
    $translateProvider.useSanitizeValueStrategy('escaped');
    $translateProvider.useLoader('i18nLoader');
})

.run(function($rootScope){
    $rootScope.maxOptionSize = 1000;
});
