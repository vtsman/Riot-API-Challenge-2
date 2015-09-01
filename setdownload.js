app.controller('SetDownloadController', function ($scope, $modalInstance, itemset, items) {
    //expose variables to angular html
    $scope.itemset = itemset;
    $scope.items = items;
    //expose is library to angular
    $scope.is = is;

    //get save file name
    $scope.filename = itemset._autochampname + ".json";
    itemset._autochampname = undefined;
    //itemset location on windows
    $scope.windowsLocation = "C:/Riot Games/League of Legends/Config/Champions/" + itemset._autochampkey + "/Recommended";
    //itemset location on mac
    $scope.macLocation = "Contents/LoL/Config/Champions/" + itemset._autochampkey + "/Recommended";
    itemset._autochampkey = undefined;
    //prepare itemset for download
    $scope.itemsetString = JSON.stringify(itemset);
    //duplicate ddragon abstraction from setbuilder.js
    $scope.getImage = function(object){
        if(object == undefined){
            return;
        }
        var image = object.image;
        if(image == undefined){
            return;
        }
        return "https://ddragon.leagueoflegends.com/cdn/" + builder.current_version + "/img/" + image.group + "/" + image.full;
    }
    //wrapper to fileSaver.js
    $scope.download = function () {
        var blob = new Blob([JSON.stringify(itemset)], {type: "text/plain;charset=utf-8"});
        saveAs(blob, $scope.filename);
    }
});