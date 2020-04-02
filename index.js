const yargs = require('yargs');
const axios = require('axios');
const log = require('loglevel');
//const moment = require('moment');
//const { pour } = require('std-pour');
//const ffmpeg = require('ffmpeg-cli');
const ffmpeg = require('fluent-ffmpeg');

const apiKey = 'fCUCjWrKPu9ylJwRAv8BpGLEgiAuThx7';
const baseUrl = 'https://f1tv.formula1.com';
const loginUrl = 'https://api.formula1.com/';
const f1TvAuthUrl = 'https://f1tv-api.formula1.com';
const loginDistributionChannel = 'd861e38f-05ea-4063-8776-a7e2b6d885a4';
const identityProviderUrl = '/api/identity-providers/iden_732298a17f9c458890a1877880d140f3/';
const auth = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1ZyI6IlVTQSIsImVtYWlsIjpudWxsLCJleHAiOjE1ODMzNjUxNzEsImlkIjoxODM4MDAzM30.lgSa79135Pxu04F_f-oQkDUP81zqsQTWpN7Jn3v-Wbw';
let authData;

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
    log.debug(`getEpisodeUrl Slug is ${slug}`);
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
    log.debug(`getSessionUrl Slug is ${slug}`);
    return axios.get('/api/session-occurrence/', {
        baseURL: baseUrl,
        params: {
            'fields': 'availability_details,status,uid',
            'slug': slug
        }
    })
    .then(response => {
        log.debug(response.data.objects);
        return axios.get(`/api/session-occurrence/${response.data.objects.shift().uid}/`, {
            baseURL: baseUrl,
            params: {
                'fields': 'channel_urls'
            }
        })
    })
    .then(response => {
        log.info('looking up channel');
        return getSessionChannelUrl(searchStr, response.data.channel_urls);
    })
}

const getSessionChannelUrl = (searchStr, channels = []) => {
    log.trace('getSessionChannelUrl', searchStr, channels);
    let channel = channels.shift();
    return axios.get(channel, {
        baseURL: baseUrl,
        params: {
            'fields_to_expand': 'driveroccurrence_urls'
        }
    })
    .then(response => {
        log.trace('getSessionChannelUrl response', response.data);
        let data = (response.data.channel_type === 'driver')?[response.data.name, response.data.driveroccurrence_urls[0].driver_tla, `${response.data.driveroccurrence_urls[0].driver_racingnumber}`]:[response.data.name];
        if ( data.find(item => item.toLowerCase().indexOf(searchStr.toLowerCase()) !== -1) !== undefined ) { return response.data.self }
        log.trace(`Calling getSesssionChannelUrl(${searchStr}, ${channels})`);
        return getSessionChannelUrl(searchStr, channels);
    })
}

const getItemUrl = (urlStr, searchStr) => {
    if ( authData.user !== undefined && authData.pass !== undefined) {
        return loginF1(authData.user, authData.pass)
            .then( token => {
                log.debug('token', token);
                authData.jwt = token;
                return (isF1tvEpisodeUrl(urlStr))?getEpisodeUrl(urlStr):getSessionUrl(urlStr, searchStr); 
            })
    }
    else {
        return (isF1tvEpisodeUrl(urlStr))?getEpisodeUrl(urlStr):getSessionUrl(urlStr, searchStr); 
    }
}

const loginF1 = (username, password) => {
    let requestData = {
        'Login': username,
        'Password': password,
        'DistributionChannel': loginDistributionChannel
    };
    let requestHeaders = {
        'apiKey': apiKey,
        'TE': 'Trailers' 
    }
    
    return axios.post('/v2/account/subscriber/authenticate/by-password', requestData, {baseURL: loginUrl, headers: requestHeaders })
        .then( response => {
            log.trace(response);
            let requestData = {
                'identity_provider_url': identityProviderUrl,
                'access_token': response.data.data.subscriptionToken
            };
            return axios.post('/agl/1.0/unk/en/all_devices/global/authenticate', requestData, {baseURL: f1TvAuthUrl});
        })
        .then( response => {
            return (response.data.token);
        })
        .catch( e => {
            log.error('-------------------------------loginF1 Error-------------------------------------');
            log.error(e);
            return null;
        })
}

const printSessionChannelList = (channels = []) => {
    let channel = channels.shift();
    //if (channels.length < 1) { return }
    return axios.get(channel, {
        baseURL: baseUrl,
        params: {
            'fields_to_expand': 'driveroccurrence_urls'
        }
    })
    .then((response) => {
        let data = (response.data.channel_type === 'driver')?`name: ${response.data.name} number: ${response.data.driveroccurrence_urls[0].driver_racingnumber} tla: ${response.data.driveroccurrence_urls[0].driver_tla}`:`name: ${response.data.name}`;
        log.debug(data);
        return (channels.length > 0)?printSessionChannelList(channels):'';
    })
}

const getSessionChannelList = (urlStr) => {
    let slug = getSlugName(urlStr);
    if (isF1tvEpisodeUrl(urlStr)) throw new Error('Video does not have multiple cameras available.');
    log.debug(`getSessionChannelList Slug is ${slug}`);
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
        log.trace(response.data);
        return printSessionChannelList(response.data.channel_urls);
    })
}

const getTokenizedUrl = itemPath => {
    let isAsset = (itemPath.indexOf('assets') !== -1);
    let item =  (isAsset)?{'asset_url': itemPath}:{'channel_url': itemPath};
    log.debug('item', item);
    log.debug('authData', authData);
    let authHeader = {'Authorization': `JWT ${authData.jwt}`};

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
            programStream: programStream,
            audioStream: audioStream,
            outputDirectory: outputDir,
            username: f1Username,
            password: f1Password,
            logLevel: logLevel
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
                        .option('program-stream', {
                            type: 'string',
                            desc: 'Specify the program for the video stream',
                            default: '0',
                            alias: 'v'
                        })
                        .option('audio-stream', {
                            type: 'string',
                            desc: 'Specify audio stream index to download',
                            default: '0',
                            alias: 'a'
                        })
                        .option('output-directory', {
                            type: 'string',
                            desc: 'Specify a directory for the downloaded file',
                            default: null,
                            alias: 'o',
                            coerce: outDir => {
                                if (outDir !== null) {
                                    if (!outDir.endsWith('\\')) {
                                        outDir = outDir + '\\';
                                    }
                                }
                                return outDir;
                            }
                        })
                        .option('username', {
                            type: 'string',
                            desc: 'F1TV User name',
                            alias: 'U'
                        })
                        .option('password', {
                            type: 'string',
                            desc: 'F1TV password',
                            alias: 'P'
                        })
                        .option('channel-list', {
                            type: 'boolean',
                            desc: 'Provides a list of channels available from url (for videos with multiple cameras)',
                            default: false
                        })
                        .option('log-level', {
                            alias: 'l',
                            desc: 'set the log level',
                            choices: ['trace', 'debug', 'info', 'warn', 'error'],
                            default: 'info'
                        })    
                })
                .demandCommand()
                .showHelpOnFail()
                .parse()

            log.setLevel(logLevel);

            log.trace(`channel-list is ${channelList} url is ${url}`);
            if (!channelList) {
                log.trace('finding url')

                log.debug('User:', f1Username, 'Password:', f1Password);

                authData ={
                    'user': f1Username,
                    'pass': f1Password,
                    'jwt': auth
                };

                getItemUrl(url, channel)
                .then(item => {
                    log.debug('item:', item);
                    return getTokenizedUrl(item);
                })
                .then(item => {
                    log.debug('tokenized url:', item);
                    log.trace(ffmpeg.path);
                    let tsFile = (isF1tvEpisodeUrl(url))?`${getSlugName(url)}.ts`:`${getSlugName(url)}-${channel.split(' ').shift()}.ts`;
                    if (outputDir !== null) {
                        log.debug('Outputting file to:', outputDir);
                        tsFile = outputDir + tsFile;
                    }
                    log.info('tsFile:', tsFile);
                    //return pour(ffmpeg.path, ['-i', item, '-loglevel', '+level', '-c', 'copy', '-map', `0:p:${programStream}:v`, '-map', `0:p:${programStream}:${audioStream}`, '-y', tsFile], {});
                    //*
                    return ffmpeg()
                        .input(item)
                        .outputOptions('-c', 'copy', '-map', `0:p:${programStream}:v`, '-map', `0:p:${programStream}:${audioStream}`, '-y')
                        .on('start', commandLine => {
                            log.info('Executing command:', commandLine);
                        })
                        .on('codecData', data => {
                            log.info('File duration:', data.duration);
                        })
                        .on('progress', info => {
                            let outStr = '\rFrames=' + `${info.frames}`.padStart(8) + ' Fps=' + `${info.currentFps}`.padStart(5) + 'fps Kbps=' + `${info.currentKbps}`.padStart(7) + 'Kbps Duration= ' + `${info.timemark}` +' Percent Complete=' + `${parseInt(info.percent)}`.padStart(3) + '%';
                            process.stdout.write(outStr);
                            log.trace('Progress:', info.percent, '%');
                        })
                        .on('error', e => {
                            log.error('ffmpeg error:', e);
                        })
                        .save(tsFile);
                    //*/
                })
                .catch(e => log.error('getItemUrl Error:', e));
            }
            if (channelList) {
                getSessionChannelList(url)
                .catch(e => log.error('getSessionChannelList Error', e.message));
            }


                    
                
    }
    catch (error) {
        log.error('Big Error:', error.message);
    }
}

