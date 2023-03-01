const config = require('./config');
//const axiosLib = require('axios');
//const { wrapper } = require('axios-cookiejar-support');
//const tough = require('tough-cookie');

const DataStore = require('./secure-local-data');
const { getF1tvToken } = require('./f1tv-token');
const { isF1tvUrl } = require('./f1tv-validator');
//const DASH = require('mpd-parser');
const HLS = require('hls-parser');
const XmlReader = require('xml-reader');
const XmlQuery = require('xml-query');
const axios = require('./f1tv-axios');

/*
const ds = new DataStore(`${config.HOME}${config.PATH_SEP}${config.DS_FILENAME}`);
let cookieJar;
try {
    cookieJar = tough.CookieJar.fromJSON(JSON.parse(ds.get('cookies')));
} 
catch (e) {
    cookieJar = new tough.CookieJar();
}

const axios = wrapper(axiosLib.create({
    withCredentials: true,
    maxContentLength: -1,
    jar: cookieJar,
    headers: {
        //"User-Agent": "AppleTV6,2/11.1",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:100.0) Gecko/20100101 Firefox/100.0",
        "Accept": "*\/*",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        //"Host": "ott-video-cf.formula1.com",
        "Accept-Language": "en-US,en;q=0.5",
        //"Origin": "https://f1tv.formula1.com",
        "DNT": "1",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-site",
        "X-API-Key": "bea454a0c6c1f265994df077b97345bdf6c289beee886491d4a741b62e50b7a7"
    }
}));
//*/

const getAdditionalStreamsInfo = (streams, searchStr) => {
    for (const stream of streams) {
        const data = (stream.type === 'obc') ? [stream.reportingName, stream.title, stream.driverFirstName + ' ' + stream.driverLastName, String(stream.racingNumber)] : [stream.reportingName, stream.title];
        //if (data.find(item => item.toLowerCase().indexOf(searchStr.toLowerCase()) !== -1)) return stream; // case insensitive
        if (data.find(item => item.indexOf(searchStr) !== -1)) return stream; // case sensitive
    }
    return null;
};

const getChannelIdFromPlaybackUrl = (url) => {
    const path = new URL(config.BASE_URL + url);
    return path.searchParams.get('channelId');
};

const getContentParams = (url) => {
    if (!isF1tvUrl(url)) throw new Error("Invalid F1TV URL");
    const content = new URL(url);
    const temp = content.pathname.split('/');
    return {
        name: temp.pop(),
        id: temp.pop()
    };
};

const getContentInfo = async (url) => {
    const content = getContentParams(url);
    let options = {
        baseURL: config.BASE_URL,
        params: {
            'contentId': content.id,
            'entitlement': config.ENTITLEMENT,
            'homeCountry': config.HOME_COUNTRY
        }
    }
    let path = '/3.0/R/ENG/BIG_SCREEN_HLS/ALL/CONTENT/VIDEO/' + content.id + '/' + config.ENTITLEMENT + '/2';
    await process.nextTick(() => { }); // clean things us so no open handles left, https://stackoverflow.com/a/70012434/486820
    let result = await axios.get(path, options);
    return result.data.resultObj.containers.shift();
};

const getContentStreamUrl = (id, channel = null) => {
    const ds = new DataStore(`${config.HOME}${config.PATH_SEP}${config.DS_FILENAME}`);
    const token = ds.get('token');
    const params = (channel === null) ? { 'contentId': id } : { 'channelId': channel, 'contentId': id };
    const options = {
        withCredentials: true,
        baseURL: config.BASE_URL,
        headers: {
            'entitlementToken': token
        },
        params: params
    };

    const path = '/2.0/R/ENG/BIG_SCREEN_HLS/ALL/CONTENT/PLAY';

    return axios.get(path, options)
        .then(result => {
            return result.data.resultObj;
        });
};

const getProgramStreamId = (url, lang, res = 'best') => {
    return axios.get(url)
        .then(result => {
            const variant = {
                playlist: null,
                bandwidth: 0,
                videoId: -1,
                audioId: -1,
                hasDRM: false
            };

            if (url.indexOf('m3u8') == -1) {

                /*
                const pl = DASH.parse(result.data);

                console.log(JSON.stringify(pl, 2, 4));

                for (let i = 0; i < pl.playlists.length; i++) {
                    const v = pl.playlists[i].attributes;
                    if (res === 'best') {
                        if (v.BANDWIDTH > variant.bandwidth) {
                            variant.bandwidth = v.BANDWIDTH;
                            variant.playlist = v;
                            variant.videoId = parseInt(v.NAME);
                            variant.width = v.RESOLUTION.width;
                            variant.height = v.RESOLUTION.height;
                        }
                    }
                    else {
                        let [w, h] = res.split('x');
                        if (v.RESOLUTION.width == parseInt(w) && v.RESOLUTION.height == parseInt(h)) {
                            variant.bandwidth = v.BANDWIDTH;
                            variant.playlist = v;
                            variant.videoId = parseInt(v.NAME);
                            variant.width = v.RESOLUTION.width;
                            variant.height = v.RESOLUTION.height;
                        }
                    }
                }
                //*/

                const mpd = XmlReader.parseSync(result.data);
                let audio;
                XmlQuery(mpd).find('AdaptationSet').each(node => {
                    if (node.attributes.mimeType == 'video/mp4') {
                        node.children.forEach(child => {
                            if (child.name == 'Representation') {
                                let v = child.attributes;
                                if (res === 'best') {
                                    if (parseInt(v.bandwidth) > variant.bandwidth) {
                                        variant.bandwidth = parseInt(v.bandwidth);
                                        variant.playlist = v;
                                        variant.videoId = parseInt(v.id);
                                        variant.width = parseInt(v.width);
                                        variant.height = parseInt(v.height);

                                        if (child.children.find(cn => cn.name == 'ContentProtection') != undefined) {
                                            variant.hasDRM = true;
                                            child.children.forEach(cp => {
                                                if (cp.name == 'ContentProtection') {
                                                    if (cp.attributes['cenc:default_KID'] != undefined) {
                                                        variant.kid = cp.attributes['cenc:default_KID'].replace(/-/g, '');
                                                    }
                                                    else {
                                                        variant.pssh = cp.children[0].children[0].value;
                                                    }
                                                }
                                            });
                                        }
                                    }
                                }
                                else {
                                    let [w, h] = res.split('x');
                                    if (parseInt(v.width) == parseInt(w) && parseInt(v.height) == parseInt(h)) {
                                        variant.bandwidth = parseInt(v.bandwidth);
                                        variant.playlist = v;
                                        variant.videoId = parseInt(v.id);
                                        variant.width = parseInt(v.width);
                                        variant.height = parseInt(v.height);
                                        
                                        if (child.children.find(cn => cn.name == 'ContentProtection') != undefined) {
                                            variant.hasDRM = true;
                                            child.children.forEach(cp => {
                                                if (cp.name == 'ContentProtection') {
                                                    if (cp.attributes['cenc:default_KID'] != undefined) {
                                                        variant.kid = cp.attributes['cenc:default_KID'].replace(/-/g, '');
                                                    }
                                                    else {
                                                        variant.pssh = cp.children[0].children[0].value;
                                                    }
                                                }
                                            });
                                        }
                                    }
                                }
                            }
                        });
                    }
                    if (node.attributes.mimeType == 'audio/mp4' && node.attributes.lang == lang) {
                        node.children.forEach(child => {
                            if (child.name == 'Representation') {
                                audio = child;
                            }
                        });
                    }
                });
                variant.audioId = parseInt(audio.attributes.id);
            }
            else {
                const pl = HLS.parse(result.data);

                for (let i = 0; i < pl.variants.length; i++) {
                    const v = pl.variants[i];
                    if (v.isIFrameOnly)
                        continue;  // skip the thumbnail track

                    if (res === 'best') {
                        if (v.bandwidth > variant.bandwidth) {
                            variant.bandwidth = v.bandwidth;
                            variant.playlist = v;
                            variant.videoId = i;
                            variant.width = v.resolution.width;
                            variant.height = v.resolution.height;
                        }
                    }
                    else {
                        let [w, h] = res.split('x');
                        if (v.resolution.width == parseInt(w) && v.resolution.height == parseInt(h)) {
                            variant.bandwidth = v.bandwidth;
                            variant.playlist = v;
                            variant.videoId = i;
                            variant.width = v.resolution.width;
                            variant.height = v.resolution.height;
                        }
                    }
                }

                for (let i = 0; i < variant.playlist.audio.length; i++) {
                    const a = variant.playlist.audio[i];
                    if (a.language == lang) {
                        variant.audioId = i;
                    }
                }
            }
            return variant;

        });
};

/*
const getWvKeys = async (licUrl, pssh) => {
    const data = {
        "license_url": licUrl,
        "pssh": pssh,
        "cache": true,
        "headers": `{"entitlementtoken": "${ds.get('token')}"}`
    };
    return axios.post(`http://getwvkeys.cc/api`, data)
        .then(res => {
            // extra quotes in response need to be removed for parsing
            //let data = JSON.parse(res.data.replace(/\"headers\":\ \"/, '\"headers\":\ ').replace(/\"\, \"time\":\ /, '\, \"time\":\ '));
            let data = res.data;
            if (data == undefined || data.keys == undefined || data.keys[0].key == undefined) {
                throw new Error('No keys found');
            }
            let licenseInfo = {
                key: data.keys[0].key,
            };
            return licenseInfo;
        });
}
*/

/*
const saveF1tvToken = async (user, pass) => {
    const ds = new DataStore(`${config.HOME}${config.PATH_SEP}${config.DS_FILENAME}`);
    const session = await getF1tvToken(user, pass);
    cookieJar = tough.CookieJar.fromJSON(JSON.parse(session.cookies));
    ds.add('token', session.token);
    ds.add('cookies', session.cookies);
    return session.token;
};
//*/

const saveF1tvToken = (token) => {
    const ds = new DataStore(`${config.HOME}${config.PATH_SEP}${config.DS_FILENAME}`);
    ds.add('token', token);
    return token;
};

const getF1tvLoginToken = () => {
    const ds = new DataStore(`${config.HOME}${config.PATH_SEP}${config.DS_FILENAME}`);
    return ds.get('token');
}


module.exports = {
    getContentParams,
    getContentInfo,
    getContentStreamUrl,
    getChannelIdFromPlaybackUrl,
    getAdditionalStreamsInfo,
    getProgramStreamId,
    saveF1tvToken,
    getF1tvLoginToken
};