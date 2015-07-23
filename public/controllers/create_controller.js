angular.module('pzlPal').controller('createController', function($scope, $http, Upload, $location) {
    $scope.formData = {};
    $scope.examples = [
        {name: "Example 1", url: "http://i.imgur.com/AiI3G0X.gif"},
        {name: "Example 2", url: "http://i.imgur.com/RA3zN3c.jpg"},
        {name: "Example 3", url: "http://i.imgur.com/6fwD9rh.jpg"},
        {name: "Example 4", url: "http://i.imgur.com/aL7mGRF.jpg"},
        {name: "Example 5", url: "http://i.imgur.com/8fr6qzG.png"},
        {name: "Example 6", url: "http://i.imgur.com/vxGGrZb.png"}
    ];
    
    $scope.createPuzzle = function() {
        $('#errors').text("");
        $('#submitBtn').attr("disabled", "disabled");
        $('#submitBtn').text("Retrieving Image...");
        $('#loadingDiv').css("display", "block");
        if ($scope.imageFile) {
            Upload.upload({
              url: 'api/puzzles',
              method: 'POST',
              file: $scope.imageFile[0]
            }).success($scope.createSuccess).error($scope.createFailure);
        } else {
            Upload.upload({
              url: 'api/puzzles',
              method: 'POST',
              data: $scope.formData
            }).success($scope.createSuccess).error($scope.createFailure);
        }
    };

    $scope.loadExample = function(url) {
        $scope.formData.imageURL = url;
        $scope.clearFile();
        $scope.createPuzzle();
    }

    $scope.createSuccess = function(data, status, headers, config) {
        $location.path("/" + data._id + "/crop");
        console.log(data);
    }

    $scope.createFailure = function(data, status, headers, config) {
        if (status==429) {
            $('#errors').text("To reduce burden on our servers, we limit users to 10 puzzles per day. We apologize for the inconvenience.");
            $('#loadingDiv').css("display", "none");
        } else {
            $('#errors').text("We were unable to process your image. Please review and submit again.");
            $('#loadingDiv').css("display", "none");
            $('#submitBtn').removeAttr("disabled");
            $('#submitBtn').text("Digitize Puzzle");
        } 
    }

    $scope.fileSelect = function() {
        if ($scope.imageFile && $scope.imageFile.length > 0) {
            $('#file-field').val($scope.imageFile[0].name);
        }
    }

    $scope.clearFile = function() {
        delete $scope.imageFile;
        $('#file-field').val("");
    }

    $scope.clearURL = function() {
        delete $scope.formData.imageURL;
    }

});