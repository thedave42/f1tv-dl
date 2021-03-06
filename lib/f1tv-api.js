const config = require('./config');
const axios = require('axios');
const DataStore = require('./secure-local-data');
const f1tvToken = require('./f1tv-token');
const { isF1tvUrl } = require('./f1tv-validator');

const getAdditionalStreamsInfo = (streams, searchStr) => {
    for ( const stream of streams ) {
        const data = (stream.type === 'obc')?[stream.title, stream.driverFirstName + ' ' + stream.driverLastName, String(stream.racingNumber)]:[stream.title];
        if (data.find( item => item.toLowerCase().indexOf(searchStr.toLowerCase()) !== -1)) return stream;
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

const getContentInfo = (url) => {
    const content = getContentParams(url);
    const options = {
        baseURL: config.BASE_URL,
    }
    const path = '/2.0/R/ENG/BIG_SCREEN_HLS/ALL/CONTENT/VIDEO/' + content.id + '/' + config.ENTITLEMENT + '/2';

    return axios.get(path, options)
        .then(result => result.data.resultObj.containers.shift());
};

const getContentStreamUrl = (id , channel=null) => {
    const ds = new DataStore(`${config.HOME}${config.PATH_SEP}${config.DS_FILENAME}`);
    const token = ds.get('token');
    const params = (channel === null)?{ 'contentId': id }:{ 'contentId': id, 'channelId': channel };
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
    saveF1tvToken    
};