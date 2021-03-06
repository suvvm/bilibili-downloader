const axios = require('axios')

var acceptDic = {
    "高清 1080P+": 112,
    "高清 1080P60": 116,
    "高清 720P60": 74,
    "高清 1080P": 80,
    "高清 720P": 64,
    "清晰 480P": 32,
    "流畅 360P": 16
}

var acceptDicRev = {
    112: "高清 1080P+",
    116: "高清 1080P60",
    74: "高清 720P60",
    80: "高清 1080P",
    64: "高清 720P",
    32: "清晰 480P",
    16: "流畅 360P"
}

exports.getInfo = async (avNumber) => {


    var videoData = {
        "title": "",
        "desc": "",
        "accept": {},
        "isOldVideo": false,
        "upName": "",
        "pageCount": 0,
        "pages": [],
        "hasError": false,
        "error": {}
    }

    var referer = "https://www.bilibili.com/video/" + avNumber
    console.log(referer)

    // await axios.get(referer, {
    //     headers: {
    //         "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKet/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36"
    //     }
    // })
    await axios.get(referer)
        .then(function (response) {

            var scripts = response["data"].match(/<script>.+?<\/script>/g)

            getVideoInfo(scripts[1], videoData)

            if (isOldVideo(scripts[0])) {
                getOldVideoAccepts(scripts[0], videoData)
                videoData["isOldVideo"] = true
            } else {
                getNewVideoAccepts(scripts[0], videoData)
            }

        })
        .catch(function (error) {
            videoData["hasError"] = true
            videoData["error"] = error
            console.log(error);
        });

    // return videoData
    // console.log(JSON.stringify(videoData))
    return videoData

}

// get video basic info
function getVideoInfo(script, videoData) {
    var init_stat_str = script.replace("<script>", "")
        .replace("</script>", "")
        .replace("window.__INITIAL_STATE__=", "")
        .replace(new RegExp(";\\(function\\(\\)\\{.*", "g"), "")
        .replace(new RegExp("\u002F", "g"), "/")

    var init_stat = JSON.parse(init_stat_str)

    //add other info
    videoData["title"] = init_stat["videoData"]["title"]
    videoData["desc"] = init_stat["videoData"]["desc"]
    videoData["upName"] = init_stat["videoData"]["owner"]["name"]

    //add parts info
    for (let index = 0; index < init_stat["videoData"]["pages"].length; index++) {
        const key = init_stat["videoData"]["pages"][index];
        videoData["pages"].push({
            "page": key["page"],
            "partName": key["part"],
        })
        videoData["pageCount"] += 1
    }
}

// judge is the video is an old video or new video
// old video doesn't split video and audio
// old video url position is different from new one
// old video page only contains urls for one accept code
// urls have patterns but that's not 100 percent accurate
function isOldVideo(script) {
    if (script.indexOf("durl") != -1 && script.indexOf("order") != -1) {
        return true
    } else {
        return false
    }
}

// get all available accepts of new videos
function getNewVideoAccepts(scripts, videoData) {
    var play_info_str = scripts.replace("<script>", "")
        .replace("</script>", "")
        .replace("window.__playinfo__=", "")
        .replace(new RegExp("\u002F", "g"), "/")


    var play_info = JSON.parse(play_info_str)

    // console.log()


    //add accept info, let user choose one
    for (let index = 0; index < play_info["data"]["dash"]["video"].length; index += 2) {
        const elm = play_info["data"]["dash"]["video"][index];
        var acceptCode = elm["id"]
        // console.log(acceptCode)
        videoData["accept"][acceptCode] = acceptDicRev[acceptCode]
    }
    // for (var elm in play_info["data"]["dash"]["video"]) {
    //     var acceptCode = elm["id"]
    //     videoData["accept"].push({
    //         "accept": { acceptCode: acceptDicRev[acceptCode] },
    //     })
    // }
}

// get old available accepts of old videos
function getOldVideoAccepts(scripts, videoData) {
    var play_info_str = scripts.replace("<script>", "")
        .replace("</script>", "")
        .replace("window.__playinfo__=", "")
        .replace(new RegExp("\u002F", "g"), "/")

    var play_info = JSON.parse(play_info_str)

    // console.log()

    //add accept info, let user choose one
    for (let index = 0; index < play_info["data"]["accept_quality"].length; index++) {
        const acceptCode = play_info["data"]["accept_quality"][index];
        videoData["accept"][acceptCode] = acceptDicRev[acceptCode]
    }
}


exports.getUrl = async (avNumber, acceptCode, part, isOld) => {

    var url = {
        "part": part,
        "videoUrl": "",
        "audioUrl": ""
    }

    var referer = "https://www.bilibili.com/video/" + avNumber

    return new Promise((resolve, reject) => {
        axios.get(referer + "?p=" + part).then((response) => {
            var scripts = response["data"].match(/<script>.+?<\/script>/g)

            var play_info_str = scripts[0].replace("<script>", "")
                .replace("</script>", "")
                .replace("window.__playinfo__=", "")
                .replace(new RegExp("\u002F", "g"), "/")

            var play_info = JSON.parse(play_info_str)

            // get video url
            if (isOld) {
                getOldVideoUrl(acceptCode, play_info["data"]["durl"], url)
            } else {
                getNewVideoUrl(acceptCode, play_info["data"]["dash"]["video"], play_info["data"]["dash"]["audio"], url)
            }

            resolve(url)

        }).catch((error) => {
            console.log(error)
            reject(error)
        })
    })

}

// get new video and audio url
function getNewVideoUrl(acceptCode, videoList, audioList, url) {

    for (let index = 0; index < videoList.length; index++) {
        const elm = videoList[index];

        if (acceptCode == elm["id"]) {
            //add video url
            var videoUrl = elm["baseUrl"].replace("http", "https")

            //add audio url, just choose the first one
            var audioUrl = audioList[0]["baseUrl"].replace("http", "https")

            url["videoUrl"] = videoUrl
            url["audioUrl"] = audioUrl

            // console.log(url)
            //jump out of loop
            break
        }
    }
}

// get old video url
// try to guess the pattern, not 100% accurate
// ex:http://upos-sz-mirrorks3.bilivideo.com/upgcxcode/88/37/35913788/35913788-1-64.flv?e=ig8euxZM2rNcNbRH7WdVhoM1nWUVhwdEto8g5X10ugNcXBlqNxHxNEVE5XREto8KqJZHUa6m5J0SqE85tZvEuENvNo8g2ENvNo8i8o859r1qXg8xNEVE5XREto8GuFGv2U7SuxI72X6fTr859r1qXg8gNEVE5XREto8z5JZC2X2gkX5L5F1eTX1jkXlsTXHeux_f2o859IB_&uipk=5&nbs=1&deadline=1579599528&gen=playurl&os=ks3bv&oi=1020835084&trid=95a30d9dd1cb451cabe2b12bfa2f87abu&platform=pc&upsig=f86fd9434bb3cf0e2d2b75dc5c7b7374&uparams=e,uipk,nbs,deadline,gen,os,oi,trid,platform&mid=37849583
function getOldVideoUrl(acceptCode, videoList, url) {
    // get base url
    var videoBaseUrl = videoList[0]["url"].replace("http", "https")
    // get formate index in order to replace accept code
    var formateIndex = videoBaseUrl.indexOf(".flv")
    // find the accept code index
    var acceptCodeIndex = videoBaseUrl.substring(0, formateIndex).lastIndexOf("-")
    // merge url
    url["videoUrl"] = videoBaseUrl.substring(0, acceptCodeIndex + 1) + acceptCode + videoBaseUrl.substring(formateIndex)
}