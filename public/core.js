angular
    .module('pzlPal', ['ngFileUpload', 'ngRoute'])
    .directive('imageonload', function() {
        return {
            restrict: 'A',
            link: function(scope, element, attrs) {
                element.bind('load', function() {
                    scope.$apply(attrs.imageonload);
                });
            }
        };
    })
    .config(function($routeProvider) {
    $routeProvider
        .when('/', {
            templateUrl : 'pages/create.html',
            controller : 'createController'
        })
        .when('/about', {
            templateUrl : 'pages/about.html',
            controller : 'createController'
        })
        .when('/:puzzle_id/crop', {
            templateUrl : 'pages/crop.html',
            controller : 'cropController'
        })
        .when('/:puzzle_id/view', {
            templateUrl : 'pages/puzzle.html',
            controller : 'puzzleController'
        })
    });