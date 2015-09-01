var API_URL = "http://build.lol:1082/api/lol/";

onmessage = function(e) {
    //Grab JSON of match, sleep then return
    getJSON(API_URL + e.data.region.code + "/v2.2/match/" + e.data.ids.pop() + "?includeTimeline=true", function(data, status) {
        if(status == 200){
            e.data.current_matches.push(data);
        }
        postMessage(e.data);
    });
}

//Can't use jQuery, so we have to define our own getJSON method
function getJSON(url, callback) {
    var type = "GET";
    var req;
    if (callback == null) {
        callback = function() {};
    }
    if (type == null) {
        //default to a GET request
        type = 'GET';
    }
    req = new XMLHttpRequest();
    req.open(type, url, false);
    req.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    req.onreadystatechange = function() {
        if (req.readyState === 4) {
            return callback(JSON.parse(req.responseText), req.status);
        }
    };
    req.send();
    return req;
};

function sleep(ms){
    var waitTimeInMilliseconds = new Date().getTime() + ms;
    while(new Date().getTime() < waitTimeInMilliseconds ) true;
}
