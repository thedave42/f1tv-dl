const config = require('./config');
const axios = require('axios');
const DataStore = require('./secure-local-data');
const f1tvToken = require('./f1tv-token');

const getSlugName = (urlStr) => {
    try { return new URL(urlStr).pathname.split('/').pop(); }
    catch (e) { return undefined; }
};

const getEpisodeUrl = (urlStr) => {
    const slug = getSlugName(urlStr);
    const options = {
        baseURL: config.BASE_URL,
        params: {
            'fields': 'items,items__ovps,items__ovps__vod_id,items__self',
            'slug': slug
        }
    };
    return axios.get('/api/episodes/', options)
        .then(response => {
            return response.data.objects.shift().items.shift();
        })
        .catch(e => e);
};

const getSessionUrl = (urlStr, searchStr = 'wif') => {
    return getSessionOccuurrence(urlStr)
        .then(id => getSessionChannels(id))
        .then(channels => getSessionChannelUrl(searchStr, channels));
};

const getSessionOccuurrence = (urlStr) => {
    const slug = getSlugName(urlStr);
    const options = {
        baseURL: config.BASE_URL,
        params: {
            'fields': 'availability_details,status,uid',
            'slug': slug
        }
    }
    return axios.get('/api/session-occurrence/', options)
        .then(response => response.data.objects.shift().uid)
};

const getSessionChannels = (id) => {
    const options = {
        baseURL: config.BASE_URL,
        params: {
            'fields': 'channel_urls'
        }
    }
    return axios.get(`/api/session-occurrence/${id}/`, options)
        .then(response => response.data.channel_urls);
};

const getSessionChannelUrl = (searchStr, channels = []) => {
    const channel = channels.shift();
    const options = {
        baseURL: config.BASE_URL,
        params: {
            'fields_to_expand': 'driveroccurrence_urls'
        }
    };

    return axios.get(channel, options)
        .then(response => {
            if (response.data.name === undefined) { throw new Error('No channel matches ' + config.makeItGreen(searchStr)); }
            const data = (response.data.channel_type === 'driver') ? [response.data.name, response.data.driveroccurrence_urls[0].driver_tla, `${response.data.driveroccurrence_urls[0].driver_racingnumber}`] : [response.data.name];
            if (data.find(item => item.toLowerCase().indexOf(searchStr.toLowerCase()) !== -1) !== undefined) { return response.data.self }
            return getSessionChannelUrl(searchStr, channels);
        })
}

const getFinalUrl = async (itemPath) => {
    const ds = new DataStore(config.DS_FILENAME);
    return ds.get('token')
        .then( token => getTokenizedUrl(itemPath, token));
 };

const getTokenizedUrl = (itemPath, jwt) => {
    const isAsset = (itemPath.indexOf('assets') !== -1);
    const item = (isAsset) ? { 'asset_url': itemPath } : { 'channel_url': itemPath };
    const authHeader = { 'Authorization': `JWT ${jwt}` };

    return axios.post('/api/viewings/', item, { baseURL: config.BASE_URL, headers: authHeader })
        .then(response => (isAsset) ? response.data.objects.shift().tata.tokenised_url : response.data.tokenised_url);
}

const saveF1tvToken = async (user, pass) => {
    const ds = new DataStore(config.DS_FILENAME);
    const sessionToken = await f1tvToken.getF1tvToken(user, pass)
    await ds.add('token', sessionToken)
    return sessionToken;
};


module.exports = {
    getSlugName,
    getEpisodeUrl,
    getSessionOccuurrence,
    getSessionChannels,
    getSessionUrl,
    getFinalUrl,
    getTokenizedUrl,
    saveF1tvToken    
};