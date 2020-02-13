const yargs = require('yargs');
const axios = require('axios');
const { pour } = require('std-pour');
const ffmpeg = require('ffmpeg-cli');

const baseUrl = 'https://f1tv.formula1.com';
const authHeader = {'Authorization': 'JWT eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1ZyI6IlVTQSIsImVtYWlsIjpudWxsLCJleHAiOjE1ODIxMzc5NjEsImlkIjoxNzM1MzU4MX0.YqyUpQmMXc6qRbt61wptFPdz9vXHJ09MGt5f_jss-JU'};

const isUrl = string => {
    try { return Boolean(new URL(string));}
    catch (e) { return false; }
}

const isF1tvUrl = urlStr => {
    try {
        if (isUrl(urlStr)) {
            let url = new URL(urlStr);
            return url.host.toLowerCase().indexOf('f1tv') !== -1 &&
                ['current-season', 'archive', 'episode'].find(item => url.pathname.toLowerCase().indexOf(item) !== -1);
        }
        return false;
    }
    catch (e) { return false; }
}

const isF1tvEpisodeUrl = urlStr => {
    try {
        if (isUrl(urlStr)) {
            return new URL(urlStr).pathname.toLowerCase().indexOf('episode') !== -1;
        }
        return false;
    }
    catch (e) { return false; }
}

const getSlugName = urlStr => {
    try { return new URL(urlStr).pathname.split('/').pop(); }
    catch (e) { return undefined; }
}

const getEpisodeUrl = urlStr => {
    let slug = getSlugName(urlStr);
    console.info(`getEpisodeUrl Slug is ${slug}`);
    return axios.get('/api/episodes/', {
        baseURL: baseUrl,
        params: {
            'fields': 'items,items__ovps,items__ovps__vod_id,items__self',
            'slug': slug
        }
    })
    .then(response => {
        return response.data.objects.shift().items.shift();
    })
}

const getSessionUrl = (urlStr, searchStr='wif') => {
    let slug = getSlugName(urlStr);
    console.info(`getSessionUrl Slug is ${slug}`);
    return axios.get('/api/session-occurrence/', {
        baseURL: baseUrl,
        params: {
            'fields': 'availability_details,status,uid',
            'slug': slug
        }
    })
    .then(response => {
        //console.info(response.data.objects);
        return axios.get(`/api/session-occurrence/${response.data.objects.shift().uid}/`, {
            baseURL: baseUrl,
            params: {
                'fields': 'channel_urls'
            }
        })
    })
    .then(response => {
        //console.info('looking up channel');
        return getSessionChannelUrl(searchStr, response.data.channel_urls);
    })
}

const getSessionChannelUrl = (searchStr, channels = []) => {
    //console.info('getSessionChannelUrl', searchStr, channels);
    let channel = channels.shift();
    return axios.get(channel, {
        baseURL: baseUrl,
        params: {
            'fields': 'channel_type,driver_urls__driver_racingnumber,driver_urls__driver_tla,driver_urls__first_name,driver_urls__image_urls__image_type,driver_urls__image_urls__url,driver_urls__image_urls,driver_urls__last_name,driver_urls__team_url__colour,driver_urls__team_url__name,driver_urls__team_url,driver_urls,name,ovps,self,slug,uid',
            'fields_to_expand': 'driver_urls,driver_urls__image_urls,driver_urls__team_url',
            'slug': 'home'
        }
    })
    .then(response => {
        let data = (response.data.channel_type === 'driver')?[response.data.name, response.data.driver_urls[0].driver_tla, `${response.data.driver_urls[0].driver_racingnumber}`]:[response.data.name];
        if ( data.find(item => item.toLowerCase().indexOf(searchStr.toLowerCase()) !== -1) !== undefined ) { return response.data.self }
        return getSessionChannelUrl(searchStr, channels);
    })
}

const getItemUrl = (urlStr, searchStr) => {
    try { return (isF1tvEpisodeUrl(urlStr))?getEpisodeUrl(urlStr):getSessionUrl(urlStr, searchStr); }
    catch (e) { return undefined; }
}

const printSessionChannelList = (channels = []) => {
    let channel = channels.shift();
    //if (channels.length < 1) { return }
    return axios.get(channel, {
        baseURL: baseUrl,
        params: {
            'fields': 'channel_type,driver_urls__driver_racingnumber,driver_urls__driver_tla,driver_urls__first_name,driver_urls__image_urls__image_type,driver_urls__image_urls__url,driver_urls__image_urls,driver_urls__last_name,driver_urls__team_url__colour,driver_urls__team_url__name,driver_urls__team_url,driver_urls,name,ovps,self,slug,uid',
            'fields_to_expand': 'driver_urls,driver_urls__image_urls,driver_urls__team_url',
            'slug': 'home'
        }
    })
    .then((response) => {
        let data = (response.data.channel_type === 'driver')?`name: ${response.data.name} number: ${response.data.driver_urls[0].driver_racingnumber} tla: ${response.data.driver_urls[0].driver_tla}`:`name: ${response.data.name}`;
        console.info(data);
        return (channels.length > 0)?printSessionChannelList(channels):'';
    })
}

const getSessionChannelList = (urlStr) => {
    let slug = getSlugName(urlStr);
    if (isF1tvEpisodeUrl(urlStr)) throw new Error('Video does not have multiple cameras available.');
    console.info(`getSessionChannelList Slug is ${slug}`);
    return axios.get('/api/session-occurrence/', {
        baseURL: baseUrl,
        params: {
            'fields': 'availability_details,status,uid',
            'slug': slug
        }
    })
    .then(response => {
        return axios.get(`/api/session-occurrence/${response.data.objects.shift().uid}/`, {
            baseURL: baseUrl,
            params: {
                'fields': 'channel_urls'
            }
        })
    })
    .then(response => {
        return printSessionChannelList(response.data.channel_urls);
    })
}

const getTokenizedUrl = itemPath => {
    let isAsset = (itemPath.indexOf('assets') !== -1);
    let item =  (isAsset)?{'asset_url': itemPath}:{'channel_url': itemPath};
    console.info('item', item);

    return axios.post('/api/viewings/', item, {baseURL: baseUrl, headers: authHeader })
        .then(response => (isAsset)?response.data.objects.shift().tata.tokenised_url:response.data.tokenised_url);
}

run();

async function run() {
    try {
        const {
            url: url,
            channel: channel,
            channelList: channelList,
            audioStream: audioStream
        } = yargs
                .command('$0 <url>', 'Download a video', (yarg) => {
                    yarg
                        .positional('url', {
                            type: 'string',
                            desc: 'The f1tv url for the video',
                            coerce: urlStr => {
                                if (isF1tvUrl(urlStr)) {
                                    return urlStr;
                                }
                                throw new Error('Not a url to a f1tv video page.')
                            }
                        })
                        .option('channel', {
                            type: 'string',
                            desc: 'Choose wif,driver,data,pit lane or specify driver name/number/tla',
                            default: 'wif',
                            alias: 'c'
                        })
                        .option('audio-stream', {
                            type: 'string',
                            desc: 'Specify audio stream index to download',
                            default: '0',
                            alias: 'a'
                        })
                        .option('channel-list', {
                            type: 'boolean',
                            desc: 'Provides a list of channels available from url (for videos with multiple cameras)',
                            default: false
                        })    
                })
                .demandCommand()
                .showHelpOnFail()
                .parse()

            //console.info(`channel-list is ${channelList} url is ${url}`);
            if (!channelList) {
                //console.info('finding url')
                getItemUrl(url, channel)
                .then(item => {return getTokenizedUrl(item)})
                .then(item => {
                    console.info('tokenized url:', item);
                    console.info(ffmpeg.path);
                    let tsFile = (isF1tvEpisodeUrl(url))?`${getSlugName(url)}.ts`:`${getSlugName(url)}-${channel.split(' ').shift()}.ts`;
                    console.info('tsFile:', tsFile);
                    return pour(ffmpeg.path, ['-i', item, '-loglevel', '+level', '-c', 'copy', '-map', '0:p:6:v', '-map', `0:p:0:${audioStream}`, '-y', tsFile], {});
                })
                .catch(e => console.error('getItemUrl Error', e.message));
            }
            if (channelList) {
                getSessionChannelList(url)
                .catch(e => console.error('getSessionChannelList Error', e.message));
            }


                    
                
    }
    catch (error) {
        console.error('Big Error:', error.message);
    }
}

