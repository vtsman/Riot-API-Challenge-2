/**
 * Created by Spencer on 8/22/15.
 */
var API_URL = "http://build.lol:1082/api/lol/";

var builder;

var max_block_size = 5;

var app = angular.module('itembuilder', ['ui.bootstrap', 'ngAnimate']);
app.controller('ItemBuilderController', function($scope, $modal) {
    //progress for loading bar
    $scope.progress = -1;

    builder = this;

    //cached api data
    builder.champ_games = {};
    builder.champs = undefined;
    builder.champ_id_name = {};
    builder.current_version = "5.14.1"
    builder.summ_id = undefined
    builder.items = undefined;
    builder.cached_games = {};

    var regions = [
        {code: "br", name: "Brazil"},
        {code: "eune", name: "EU Nordic & East"},
        {code: "euw", name: "EU West"},
        {code: "kr", name: "Korea"},
        {code: "lan", name: "Latin America North"},
        {code: "las", name: "Latin America South"},
        {code: "na", name: "North America"},
        {code: "oce", name: "Oceana"},
        {code: "pbe", name: "Public Beta Environment"},
        {code: "ru", name: "Russia"},
        {code: "tr", name: "Turkey"}
    ];

    builder.region = regions[6];

    //list of played champions
    builder.summ_champ_list = [];

    builder.init = function(){
        //Get static champion, item, and version data
        $.getJSON(API_URL + "static-data/na/v1.2/champion?champData=image", function(data){
            builder.champs = data.data
            for(var ind in data.data){
                var champ = data.data[ind];
                builder.champ_id_name[champ.id] = champ.key;
            }
        });
        //used for ddragon calls
        $.getJSON(API_URL + "static-data/na/v1.2/versions", function (data) {
            builder.current_version = data[0]
        });
        $.getJSON(API_URL + "static-data/na/v1.2/item?itemListData=gold,image", function (data) {
            builder.items = data.data;
            builder.items[0] = undefined;
        });
    }

    builder.getUser = function(uname){
        //get summoner id, then get match list
        $.getJSON(API_URL +  builder.region.code + "/v1.4/summoner/by-name/" + uname, function(summ){
            builder.summ_id = summ[uname.split(" ").join("").toLowerCase()].id
            $.getJSON(API_URL + builder.region.code + "/v2.2/matchlist/by-summoner/" + builder.summ_id + "?seasons=SEASON2015", function(data){
                //clear and repopulate game list
                builder.champ_games = {};

                for(var ind in data.matches){
                    var match = data.matches[ind];
                    if(builder.champ_games[match.champion] === undefined){
                        builder.champ_games[match.champion] = [];
                    }
                    builder.champ_games[match.champion].push(match.matchId)
                }
                //enumerate played champions
                builder.summ_champ_list = [];

                for(var champ_id in builder.champ_games) {
                    var item = {};
                    item.champ = builder.champs[builder.champ_id_name[champ_id]];
                    item.count = builder.champ_games[champ_id].length;
                    builder.summ_champ_list.push(item);
                }
                //trigger animation of login form
                $("#uname_form").removeClass("middle");
                $scope.$apply()
            })
        });
    }

    //wraps ddragon resource calls
    builder.getImage = function(object){
        if(object == undefined){
            return;
        }
        var image = object.image;
        if(image == undefined){
            return;
        }
        return "https://ddragon.leagueoflegends.com/cdn/" + builder.current_version + "/img/" + image.group + "/" + image.full;
    }

    builder.calculate = function(champ){
        //duplicate list of games played with a champion
        var game_ids = builder.champ_games[champ.champ.id].slice(0);
        //get match list and compute itemset
        getMatches(game_ids, [], compute, champ)
    }

    function compute(champ){
        //get cached matches
        matches = builder.cached_games[champ.champ.id];
        //list of match builds
        var builds = []
        matches.forEach(function(match){
            var player_id = undefined;
            //Get player id
            match.participantIdentities.forEach(function(part){
                if(part.player.summonerId == builder.summ_id){
                    player_id = part.participantId;
                }
            });

            var build = [];

            //get list of item events with player
            var item_events = [];
            if(match.timeline != undefined){
                match.timeline.frames.forEach(function(frame){
                    if(frame.events != undefined){
                        frame.events.forEach(function(event){
                            //get item purchase events and add them to list
                            if(event.eventType == "ITEM_PURCHASED" && event.participantId == player_id){
                                item_events.push(event);
                            }
                        })
                    }
                });
            }

            //convert item events into build path
            var build_frame = [];
            var last_time = item_events[0].timestamp;
            item_events.forEach(function(event){
                if(event.timestamp - last_time > 5000){
                    build.push(build_frame.filter(unique));
                    build_frame = [];
                }
                build_frame.push(event.itemId);
                last_time = event.timestamp;
            });

            //get final build
            var final = [];
            for(var i = 0; i < 7; i++){
                final.push(match.participants[player_id - 1].stats["item" + i]);
            }
            build.push(final.filter(unique));
            //push build to list
            builds.push(build);
        });
        //compute build average and make itemset json
        generate_item_set(builds, champ);
    }
    //filter array into unique array
    function unique(item, pos, self) {
        return self.indexOf(item) == pos;
    }

    function generate_item_set(builds, champ){
        //final itemset
        var itemset = {};
        //basic header
        itemset.title = "Generated " + champ.champ.name + " itemset";
        itemset.type = "custom";
        itemset.map = "SR";
        itemset.mode = "any";
        itemset.priority = true;
        itemset.sortrank = 0;
        itemset.blocks = [];
        //temporary variables for communicating with download modal
        itemset._autochampname = champ.champ.name;
        itemset._autochampkey = champ.champ.key;
        //get final builds
        var final_items = [];

        builds.forEach(function(build){
            build[build.length - 1].forEach(function(item){final_items.push(item)})
        })
        //filter out duplicates from final build block and sort by price
        final_items = final_items.filter(unique);
        final_items = final_items.sort(function(a, b){
            if(builder.items[a] == undefined){
                return 1;
            }
            if(builder.items[b] == undefined){
                return -1;
            }
            return builder.items[b].gold.total - builder.items[a].gold.total;
        })
        //get 6 most expensive items
        final_items = final_items.slice(0, final_items.length < 6?final_items.length:6);
        //get starting items like dorans, pots, trinket, etc.
        var intro_items = [];

        builds.forEach(function(build){
            build[0].forEach(function(item){intro_items.push(item)})
        })
        //add to itemset
        addBlock(itemset, intro_items, "Starting items");

        //get list of items not bought at start of final build
        var mid_items = [];
        builds.forEach(function(build, buildnum){
            var item_count = {};
            build.slice(1, build.length - 1).forEach(function(slice, index){
                slice.forEach(function(item){
                    if(item_count[item] == undefined){
                        item_count[item] = 0;
                    }
                    else{
                        item_count[item]++;
                    }
                    //add basic info like item id, number of previous purchases of said item, when it was bought, and in what build
                    mid_items.push({
                        item: item,
                        itemCount: item_count[item],
                        index: index,
                        buildNum: buildnum
                    });
                });
            });
        });
        //dictionary of lists to item id + number (1st amp tome, 2nd, etc.) to back # (bought first back, 5th, etc.)
        var mid_item_avg_list = {};

        mid_items.forEach(function(item){
            var key = item.item + "-" + item.itemCount;
            if(mid_item_avg_list[key] == undefined){
                mid_item_avg_list[key] = [];
            }
            mid_item_avg_list[key].push(item.index);
        });
        //create list of items with averaged back #s. Goes through mid_item_avg_list and averages the value arrays
        var mid_item_avg_list_avg = [];

        for (var key in mid_item_avg_list) {
            if (mid_item_avg_list.hasOwnProperty(key)) {
                var val = mid_item_avg_list[key];
                var avg = 0;
                var avg_count = 0;
                val.forEach(function(count){
                    avg += count;
                    avg_count++;
                })
                avg /= avg_count;

                mid_item_avg_list_avg.push({
                    item: key.split("-")[0],
                    index: avg
                })
            }
        }
        //sort by back #
        mid_item_avg_list_avg.sort(function(a, b){
            return a.index - b.index;
        })
        //back # is a float, so the order could be (1.33, 2.1, 4). Changes floats to sequential int indices
        var itemset_mid_items_preclean = [];

        mid_item_avg_list_avg.forEach(function(item){
            if(itemset_mid_items_preclean[item.index] == undefined){
                itemset_mid_items_preclean[item.index] = [];
            }
            itemset_mid_items_preclean[item.index].push(item.item);
        });

        //group averaged item groups into blocks of max size specified by max_block_size
        //the max block size of 5 was chosen arbitrarily, but it looked nice
        var itemset_mid_items = [];

        itemset_mid_items_preclean.forEach(function(itemslice){
            if(itemset_mid_items.length == 0){
                itemset_mid_items.push(itemslice);
            }
            else{
                if(itemset_mid_items[itemset_mid_items.length - 1].length + itemslice.length <= max_block_size){
                    itemset_mid_items[itemset_mid_items.length - 1] = itemset_mid_items[itemset_mid_items.length - 1].concat(itemslice)
                }
                else{
                    itemset_mid_items.push(itemslice);
                }
            }
        });

        //create item block names
        //mostly dealing with ordinal number suffixes
        itemset_mid_items.forEach(function(itemslice, index){
            var name = index + 1 + "";
            if(name == 1){
                name += "st";
            }
            else if(name == 2){
                name += "nd";
            }
            else if(name == 3){
                name += "rd";
            }
            else if(name.substr(name.length - 1) == 1){
                if(name.substr(name.length - 2) == 11){
                    name += "th"
                }
                else{
                    name += "st";
                }
            }
            else if(name.substr(name.length - 1) == 2){
                if(name.substr(name.length - 2) == 11){
                    name += "th"
                }
                else{
                    name += "nd";
                }
            }
            else if(name.substr(name.length - 1) == 3){
                if(name.substr(name.length - 2) == 11){
                    name += "th"
                }
            else{
                    name += "rd";
                }
            }
            else{
                name += "th";
            }
            name += " back";
            //add mid game items blocks
            addBlock(itemset, itemslice, name);
        })
        //add final items block
        addBlock(itemset, final_items, "Final build");
        //set global itemset variable
        builder.itemset = itemset;
        //open download modal
        builder.openDownloadDialog();
    }

    //add block to itemset
    function addBlock(itemset, items, name){
        var block = {};
        block.type = name;
        block.recMath = false;
        block.minSummonerLevel = -1;
        block.maxSummonerLevel = -1;
        block.showIfSummonerSpell = "";
        block.hideIfSummonerSpell = "";
        block.items = [];
        items.filter(unique).forEach(function(item){
            var entry = {};
            entry.id = item + "";
            entry.count = 1;
            //add item to block if the item exists
            if(builder.items[item] != undefined){
                block.items.push(entry);
            }
        })
        itemset.blocks.push(block);
    }

    builder.getChampList = function(){
        return builder.summ_champ_list.sort(function (a, b) {
            if(a.champ.name > b.champ.name){
                return 1;
            }
            return -1;
        });
    }

    //load and display modal
    builder.openDownloadDialog = function () {
        var modalInstance = $modal.open({
            animation: true,
            templateUrl: 'setdownload.html',
            controller: 'SetDownloadController',
            resolve: {
                itemset: function () {
                    return builder.itemset;
                },
                items: function () {
                    return builder.items;
                }
            }
        });
    };

    function getMatches(ids, current_matches, callback, champ){
        //if game is cached, run callback
        if(builder.cached_games[champ.champ.id] != undefined){
            callback(champ);
            $scope.progress = -1;
            return;
        }
        //done downloading matches
        if(ids.length == 0){
            builder.cached_games[champ.champ.id] = current_matches;
            callback(champ);
            $scope.progress = -1;
            return;
        }
        //set progress bar
        $scope.progress = current_matches.length / (current_matches.length + ids.length) * 100;
        $scope.$apply()
        //create match fetching webworker
        var gameworker = new Worker("gameworker.js");
        gameworker.onmessage = function(e){
            //kill web worker and recurse
            gameworker.terminate();
            getMatches(e.data.ids, e.data.current_matches, callback, champ);
        }
        //set args to webworker
        gameworker.postMessage({ids: ids, current_matches: current_matches, region: builder.region});
    }
    //check for enter key on username form
    builder.loginKeypress = function(event){
        var keyCode = event.which || event.keyCode;
        if (keyCode === 13) {
            builder.getUser($scope.uname);
        }
    }

    builder.getRegions = function(){
        return regions;
    }

    builder.setRegion = function (region) {
        builder.region = region;
    }

    builder.getChampTooltip = function(champ){
        var out = champ.champ.name + " - " + champ.count + " game";
        if(champ.count > 1){
            out += 's'
        };
        out += " played";
        return out;
    }
});