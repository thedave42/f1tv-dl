const config = require('./lib/config');

const yargs = require('yargs');
const log = require('loglevel');
const ffmpeg = require('@thedave42/fluent-ffmpeg');
const axios = require('axios');

const { isF1tvUrl, isF1tvEpisodeUrl } = require('./lib/f1tv-validator');
const { getSessionUrl, getFinalUrl, getEpisodeUrl, saveF1tvToken, getSlugName } = require('./lib/f1tv-api');

const printSessionChannelList = (channels = []) => {
    let channel = channels.shift();
    //if (channels.length < 1) { return }
    return axios.get(channel, {
        baseURL: config.BASE_URL,
        params: {
            'fields_to_expand': 'driveroccurrence_urls'
        }
    })
    .then((response) => {
        let data = (response.data.channel_type === 'driver')?`name: ${config.makeItGreen(response.data.name)}`.padEnd(37) + `number: ${config.makeItGreen(response.data.driveroccurrence_urls[0].driver_racingnumber)}`.padEnd(22) + `tla: ${config.makeItGreen(response.data.driveroccurrence_urls[0].driver_tla)}`:`name: ${config.makeItGreen(response.data.name)}`;
        log.info(data);
        return (channels.length > 0)?printSessionChannelList(channels):'';
    })
}

const getSessionChannelList = (urlStr) => {
    let slug = getSlugName(urlStr);
    if (isF1tvEpisodeUrl(urlStr)) throw new Error('Video does not have multiple cameras available.');
    log.debug(`getSessionChannelList Slug is ${slug}`);
    return axios.get('/api/session-occurrence/', {
        baseURL: config.BASE_URL,
        params: {
            'fields': 'availability_details,status,uid',
            'slug': slug
        }
    })
    .then(response => {
        return axios.get(`/api/session-occurrence/${response.data.objects.shift().uid}/`, {
            baseURL: config.BASE_URL,
            params: {
                'fields': 'channel_urls'
            }
        })
    })
    .then(response => {
        log.debug(response.data);
        return printSessionChannelList(response.data.channel_urls);
    })
}

(async () => {
    try {
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
                    })
                    .option('output-directory', {
                        type: 'string',
                        desc: 'Specify a directory for the downloaded file',
                        alias: 'o',
                        default: process.env.F1TV_OUTDIR || null,
                        coerce: outDir => {
                            if (outDir !== null) {
                                if (!outDir.endsWith(config.PATH_SEP)) {
                                    outDir = outDir + config.PATH_SEP;
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
            .parse();

        log.setLevel(logLevel);

        if (channelList) return getSessionChannelList(url);

        const assetId = (isF1tvEpisodeUrl(url)) ? await getEpisodeUrl(url) : await getSessionUrl(url, channel);
        (isF1tvEpisodeUrl(url))?log.info(`Found episode id for ${config.makeItGreen(getSlugName(url))}.`):log.info(`Found session id for ${config.makeItGreen(getSlugName(url))} channel ${config.makeItGreen(channel)}`);

        let f1tvUrl;
        try {
            f1tvUrl = await getFinalUrl(assetId);
        }
        catch (e) {
            if (e.response.status >= 400 && e.response.status <= 499) {
                if (f1Username == null || f1Password == null ) throw new Error('Please provide a valid username and password.');
                log.info('Login required.  This may take 10-30 seconds.');
                await saveF1tvToken(f1Username, f1Password);
                log.info('Authorization token encrypted and stored for future use at:', config.makeItGreen(`${config.HOME}${config.PATH_SEP}${config.DS_FILENAME}`));
                f1tvUrl = await getFinalUrl(assetId);
            }
        }

        log.debug('tokenized url:', f1tvUrl);
        const ext = (format == "mp4") ? 'mp4' : 'ts';
        const outFile = (isF1tvEpisodeUrl(url)) ? `${getSlugName(url)}.${ext}` : `${getSlugName(url)}-${channel.split(' ').shift()}.${ext}`;
        const outFileSpec = (outputDir !== null) ? outputDir + outFile : outFile;

        log.info('Output file:', config.makeItGreen(outFileSpec));
        const options = (format == "mp4") ?
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
            ] :
            [
                '-c',
                'copy',
                '-map',
                `0:p:${programStream}:v`,
                '-map', `0:p:${programStream}:${audioStream}`,
                '-y'
            ];

        return ffmpeg()
            .input(f1tvUrl)
            .outputOptions(options)
            .on('start', commandLine => {
                log.debug('Executing command:', config.makeItGreen(commandLine));
            })
            .on('codecData', data => {
                log.debug(data.video);
                log.debug(data.audio);
                log.info('File duration:', config.makeItGreen(data.duration),'\n');
            })
            .on('progress', info => {
                const outStr = '\rFrames=' + config.makeItGreen(`${info.frames}`.padStart(10)) + ' Fps=' + config.makeItGreen(`${info.currentFps}`.padStart(5) + 'fps') + ' Kbps=' + config.makeItGreen(`${info.currentKbps}`.padStart(7) + 'Kbps') + ' Duration=' + config.makeItGreen(`${info.timemark}`) + ' Percent Complete=' + config.makeItGreen(`${parseInt(info.percent)}`.padStart(3) + '%');
                process.stdout.write(outStr);
            })
            .on('end', () => {
                log.info('\nDownload complete.');
            })
            .on('error', e => {
                log.error('ffmpeg error:', e.message);
                log.debug(e);
            })
            .save(outFileSpec);
    }
    catch (error) {
        log.error('Error:', error.message);
        log.debug(error);
    }
})();




