const config = require('./config');
const axios = require('axios');
const DataStore = require('./secure-local-data');
const f1tvToken = require('./f1tv-token');
const { isF1tvUrl } = require('./f1tv-validator');
const HLS = require('hls-parser');

const getAdditionalStreamsInfo = (streams, searchStr) => {
    console.log(streams);
    for (const stream of streams) {
        const data = (stream.type === 'obc') ? [stream.reportingName, stream.title, stream.driverFirstName + ' ' + stream.driverLastName, String(stream.racingNumber)] : [stream.reportingName, stream.title];
        if (data.find(item => item.toLowerCase().indexOf(searchStr.toLowerCase()) !== -1)) return stream;
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
    let path = '/3.0/R/ENG/WEB_DASH/ALL/CONTENT/VIDEO/' + content.id + '/' + config.ENTITLEMENT + '/2';
    await process.nextTick(() =>{}); // clean things us so no open handles left, https://stackoverflow.com/a/70012434/486820
    let result = await axios.get(path, options);
    return result.data.resultObj.containers.shift();
};

const getContentStreamUrl = (id, channel = null) => {
    const ds = new DataStore(`${config.HOME}${config.PATH_SEP}${config.DS_FILENAME}`);
    const token = ds.get('token');
    const params = (channel === null) ? { 'contentId': id } : { 'contentId': id, 'channelId': channel };
    const options = {
        baseURL: config.BASE_URL,
        headers: {
            'entitlementtoken': token
        },
        params: params
    }
    const path = '/1.0/R/ENG/BIG_SCREEN_HLS/ALL/CONTENT/PLAY';

    return axios.get(path, options)
        .then(result => result.data.resultObj.url);
};

const getProgramStreamId = (url, lang) => {
    return axios.get(url)
        .then(result => {
            const pl = HLS.parse(result.data);
            const variant = {
                playlist: null,
                bandwidth: 0,
                videoId: -1,
                audioId: -1
            };

            //console.log(JSON.stringify(pl, null, 4));

            for (let i = 0; i < pl.variants.length; i++) {
                const v = pl.variants[i];
                if (v.bandwidth > variant.bandwidth) {
                    variant.bandwidth = v.bandwidth;
                    variant.playlist = v;
                    variant.videoId = i;
                }
            }

            for (let i = 0; i < variant.playlist.audio.length; i++) {
                const a = variant.playlist.audio[i];
                if ( a.language == lang ) {
                    //console.log(a);
                    variant.audioId = i;
                }
            }
            //console.log(JSON.stringify(variant, 2, 4));

            return [variant.videoId, variant.audioId];
        });
};

const saveF1tvToken = async (user, pass) => {
    const ds = new DataStore(`${config.HOME}${config.PATH_SEP}${config.DS_FILENAME}`);
    const sessionToken = await f1tvToken.getF1tvToken(user, pass);
    ds.add('token', sessionToken);
    return sessionToken;
};


module.exports = {
    getContentParams,
    getContentInfo,
    getContentStreamUrl,
    getChannelIdFromPlaybackUrl,
    getAdditionalStreamsInfo,
    getProgramStreamId,
    saveF1tvToken
};