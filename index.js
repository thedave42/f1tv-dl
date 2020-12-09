#!/usr/bin/env node

const config = require('./lib/config');

const yargs = require('yargs');
const axios = require('axios');
const log = require('loglevel');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

const { isF1tvUrl, isF1tvEpisodeUrl, getSlugName } = require('./lib/f1tv-validator');

const apiKey = config.API_KEY;
const baseUrl = config.BASE_URL;
const loginUrl = config.LOGIN_URL;
const f1TvAuthUrl = config.AUTH_URL;
const loginDistributionChannel = config.DIST_CHANNEL;
const identityProviderUrl = config.F1TV_IDP;
let authData;

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
    .catch(e => {
        log.error("Error with Episode URL lookup");
        throw e;
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
        log.info('Looking up channel for ' + makeItGreen(searchStr));
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
        if ( response.data.name === undefined ) { throw new Error('No channel matches ' + makeItGreen(searchStr)); }
        let data = (response.data.channel_type === 'driver')?[response.data.name, response.data.driveroccurrence_urls[0].driver_tla, `${response.data.driveroccurrence_urls[0].driver_racingnumber}`]:[response.data.name];
        log.debug('!!!!~!~~~: ', data);
        if ( data.find(item => item.toLowerCase().indexOf(searchStr.toLowerCase()) !== -1) !== undefined ) { return response.data.self }
        log.trace(`Calling getSesssionChannelUrl(${searchStr}, ${channels})`);
        return getSessionChannelUrl(searchStr, channels);
    })
}

const getItemUrl = (urlStr, searchStr) => {
    if ( authData.user !== null && authData.pass !== null) {
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
    log.debug(`loginF1 called with username ${username}`);
    let requestData = {
        'Login': username,
        'Password': password,
        'DistributionChannel': loginDistributionChannel
    };
    let requestHeaders = {
        'apiKey': apiKey,
        'TE': 'Trailers',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.66 Safari/537.36'
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
            try {
                fs.writeFileSync('.f1tvtoken', response.data.token);
            } catch (e) {
                log.error('Token file was not saved.');
            }
            return (response.data.token);
        })
        .catch( e => {
            log.error('-------------------------------loginF1 Error-------------------------------------');
            log.error(e);
            return null;
        })
}

const makeItGreen = (str) => {
    return '\x1b[32m' + str + '\x1b[37m';
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
        let data = (response.data.channel_type === 'driver')?`name: ${makeItGreen(response.data.name)}`.padEnd(37) + `number: ${makeItGreen(response.data.driveroccurrence_urls[0].driver_racingnumber)}`.padEnd(22) + `tla: ${makeItGreen(response.data.driveroccurrence_urls[0].driver_tla)}`:`name: ${makeItGreen(response.data.name)}`;
        log.info(data);
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
        log.info(process.env);
        const {
            url: url,
            channel: channel,
            channelList: channelList,
            programStream: programStream,
            audioStream: audioStream,
            format: format,
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
                        .option('format', {
                            type: 'string',
                            desc: 'Specify mp4 or TS output (default mp4)',
                            choices: ['mp4', 'ts'],
                            default: 'mp4',
                            alias: 'f'
                        })                        .option('output-directory', {
                            type: 'string',
                            desc: 'Specify a directory for the downloaded file',
                            alias: 'o',
                            default: process.env.F1TV_OUTDIR || null,
                            coerce: outDir => {
                                if (outDir !== null) {
                                    if (!outDir.endsWith(path.sep)) {
                                        outDir = outDir + path.sep;
                                    }
                                }
                                return outDir;
                            }
                        })
                        .option('username', {
                            type: 'string',
                            desc: 'F1TV User name',
                            alias: 'U',
                            default: process.env.F1TV_USER || null
                        })
                        .option('password', {
                            type: 'string',
                            desc: 'F1TV password',
                            alias: 'P',
                            default: process.env.F1TV_PASS || null
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
            log.trace(process.env);

            log.trace(`channel-list is ${channelList} url is ${url}`);
            if (!channelList) {
                log.trace('finding url')

                log.debug('User:', f1Username, 'Password:', f1Password);
                let auth;

                try {
                    auth = fs.readFileSync('.f1tvtoken', 'utf-8');
                }
                catch (err) {
                    auth = null;
                    log.info('No token file found.');
                }

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
                    let ext = (format == "mp4")?'mp4':'ts';
                    let outFile = (isF1tvEpisodeUrl(url))?`${getSlugName(url)}.${ext}`:`${getSlugName(url)}-${channel.split(' ').shift()}.${ext}`;
                    if (outputDir !== null) {
                        log.debug('Outputting file to:', outputDir);
                        outFile = outputDir + outFile;
                    }
                    log.info('Output file:', makeItGreen(outFile));
                    let options = (format == "mp4")?
                        [
                            '-c', 
                            'copy', 
                            '-bsf:a', 
                            'aac_adtstoasc', 
                            '-movflags', 
                            'faststart', 
                            '-map', 
                            `0:p:${programStream}:v`, 
                            '-map', `0:p:${programStream}:${audioStream}`, 
                            '-y'
                        ]:
                        [
                            '-c', 
                            'copy', 
                            '-map', 
                            `0:p:${programStream}:v`, 
                            '-map', `0:p:${programStream}:${audioStream}`, 
                            '-y'                            
                        ];
                    return ffmpeg()
                        .input(item)
                        .outputOptions(options)
                        .on('start', commandLine => {
                            log.info('Executing command:', makeItGreen(commandLine));
                        })
                        .on('codecData', data => {
                            log.debug(data.video);
                            log.debug(data.audio)
                            log.info('File duration:', makeItGreen(data.duration));
                        })
                        .on('progress', info => {
                            let outStr = '\rFrames=' + makeItGreen(`${info.frames}`.padStart(10)) + ' Fps=' + makeItGreen(`${info.currentFps}`.padStart(5) + 'fps') + ' Kbps=' + makeItGreen(`${info.currentKbps}`.padStart(7) + 'Kbps') + ' Duration= ' + makeItGreen(`${info.timemark}`) +' Percent Complete=' + makeItGreen(`${parseInt(info.percent)}`.padStart(3) + '%');
                            process.stdout.write(outStr);
                        })
                        .on('end', () => {
                            log.info('\nDownload complete.');
                        })
                        .on('error', e => {
                            log.error('ffmpeg error:', e);
                        })
                        .save(outFile);
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

