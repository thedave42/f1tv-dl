#!/usr/bin/env node
const config = require('./lib/config');

const yargs = require('yargs');
const log = require('loglevel');
const ffmpeg = require('@thedave42/fluent-ffmpeg');
const inquirer = require('inquirer');
const util = require('util');
const tvdb = require('../tvdb-namer');
const DASHDownloader = require('./lib/dash-downloader');
const bento4Bin = require('@wickednesspro/bento4-latest');
const bento4 = require('fluent-bento4')({ bin: bento4Bin.binPath });

const { isF1tvUrl, isRace, isRaceSeries, validKey } = require('./lib/f1tv-validator');
const { getContentInfo, getContentStreamUrl, getAdditionalStreamsInfo, saveF1tvToken, getF1tvLoginToken, getProgramStreamId } = require('./lib/f1tv-api');
const { Streams, VideoStream, AudioStream, StreamProgressTracker } = require('./lib/streams');
let getWvKeys;
try {
    // If you know how to deal with this, here's your chance.  I'm not providing help with this.
    getWvKeys = require('./lib/getwvkeys');
}
catch (e) {
    getWvKeys = (data) => {throw new Error(data);}
}


const fixedLength = (str, length) => {
    return (str.length > length) ? str.substring(0, length) : str.padStart(length);
};

const getSessionChannelList = (url) => {
    getContentInfo(url)
        .then(result => {
            if (isRace(result)) {
                for (const stream of result.metadata.additionalStreams) {
                    const data = (stream.type === 'obc') ? `name: ${config.makeItGreen(stream.driverFirstName + ' ' + stream.driverLastName)}`.padEnd(37) + `number: ${config.makeItGreen(stream.racingNumber)}`.padEnd(22) + `tla: ${config.makeItGreen(stream.title)}` : `name: ${config.makeItGreen(stream.title)}`;
                    log.info(data);
                }
            }
            else {
                log.info('This url does not have additonal streams.');
            }
        });
};

const getTokenizedUrl = async (url, content, channel) => {
    let f1tvUrl;
    log.debug(JSON.stringify(content.metadata, 2, 4));
    if (content.metadata.additionalStreams == null) {
        f1tvUrl = await getContentStreamUrl(content.id);
    }
    else {
        if (isRace(content) && channel == null)
            channel = (content.metadata.season > 2021) ? "F1 LIVE" : "INTERNATIONAL";
        let stream = getAdditionalStreamsInfo(content.metadata.additionalStreams, channel);
        let channelId = (stream.playbackUrl !== null && stream.playbackUrl.indexOf('channelId') == -1) ? null : stream.channelId;
        f1tvUrl = await getContentStreamUrl(content.id, channelId);
    }
    return f1tvUrl;
};

const capitalizeFirstLetter = ([first, ...rest]) => {
    return [first.toUpperCase(), ...rest].join('');
};

(async () => {
    try {
        let {
            url: url,
            channel: channel,
            channelList: channelList,
            internationalAudio: internationalAudio,
            itsoffset: itsoffset,
            audioStream: audioStream,
            videoSize: videoSize,
            format: format,
            outputDirectory: outputDir,
            token: token,
            //username: f1Username,
            //password: f1Password,
            streamUrl: streamUrl,
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
                        desc: 'Choose an alternate channel for a content with multiple video feeds. Use the channel-list option to see a list of channels and specify name/number/tla to select alternate channel.',
                        default: null,
                        alias: 'c'
                    })
                    .option('international-audio', {
                        type: 'string',
                        desc: 'Select a language to include from the INTERNATIONAL feed. This audio will be included in the file as a secondary audio track.',
                        choices: ['eng', 'nld', 'deu', 'fra', 'por', 'spa', 'fx'],
                        alias: 'i'
                    })
                    .option('itsoffset', {
                        type: 'string',
                        desc: 'Used to sync secondary audio. Specify the time offset as \'(-)hh:mm:ss.SSS\'',
                        alias: 't',
                        default: '-00:00:03.750',
                        coerce: key => {
                            const pattern = new RegExp(/^'?-?\d{2}:\d{2}:\d{2}\.\d{3}'?/);
                            if (!pattern.test(key))
                                throw new Error(`Invalid format for itsoffset: ${key}. Use (-)hh:mm:ss.SSS`);
                            return key.replace(/'/g, '');
                        }
                    })
                    .option('audio-stream', {
                        type: 'string',
                        desc: 'Specify audio stream language to download',
                        default: 'eng',
                        alias: 'a'
                    })
                    .option('video-size', {
                        type: 'string',
                        desc: 'Specify video size to download as WxH or \'best\' to select the highest resolution. (e.g. 640x360, 1920x1080, best)',
                        default: 'best',
                        alias: 's'
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
                    .option('token', {
                        type: 'string',
                        desc: 'F1TV Entitlement Token',
                        alias: 'T',
                        default: process.env.F1TV_TOKEN || null
                    })
                    /*
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
                    //*/
                    .option('channel-list', {
                        type: 'boolean',
                        desc: 'Provides a list of channels available from url (for videos with multiple cameras)',
                        default: false
                    })
                    .option('stream-url', {
                        type: 'boolean',
                        desc: 'Return the tokenized URL for use in another application and do not download the video',
                        default: false
                    })
                    .option('log-level', {
                        alias: 'l',
                        desc: 'Set the log level',
                        choices: ['trace', 'debug', 'info', 'warn', 'error'],
                        default: 'info'
                    })
            })
            .demandCommand()
            .showHelpOnFail()
            .parse();

        log.setLevel(logLevel);

        if (channelList) return getSessionChannelList(url);

        const content = await getContentInfo(url);

        let f1tvUrl = '';
        try {
            f1tvUrl = await getTokenizedUrl(url, content, channel);
        }
        catch (e) {
            log.debug(e);
            if (e.response.status >= 400 && e.response.status <= 499) {
                /*
                if (f1Username == null || f1Password == null) {
                    const userPrompt = await inquirer.prompt([
                        {
                            type: 'input',
                            name: 'f1Username',
                            message: 'Enter your F1TV user name:',
                            default: f1Username
                        },
                        {
                            type: 'password',
                            name: 'f1Password',
                            message: 'Enter your F1TV password:',
                            default: f1Password
                        }
                    ]);
                    f1Username = userPrompt.f1Username;
                    f1Password = userPrompt.f1Password;
                    if (f1Username == null || f1Password == null || f1Username.length == 0 || f1Password.length == 0)
                        throw new Error('Please provide a valid username and password.');
                }
                log.info('Login required.  This may take 10-30 seconds.');
                await saveF1tvToken(f1Username, f1Password);
                //*/
                if (token == null) {
                    log.info('You need a valid F1TV login to use this applicaiton.');
                    log.info('When are logged into the website, you can use the JavaScript debug console in your browser to retrieve the token using the following JavaScript:\n');
                    log.info(config.makeItGreen(`\tconsole.log(document.cookie.split(';').filter(cookie => cookie.indexOf('entitlement_token')!=-1)[0].split('=')[1])\n`));
                    const userPrompt = await inquirer.prompt([
                        {
                            type: 'input',
                            name: 'token',
                            message: 'Enter F1TV Entitlement Token:',
                            default: token
                        }
                    ]);
                    if (userPrompt.token == null || userPrompt.token.length == 0)
                        throw new Error('Please provide a valid token.');
                    token = userPrompt.token;
                }
                token = saveF1tvToken(token);
                log.info('Authorization token encrypted and stored for future use at:', config.makeItGreen(`${config.HOME}${config.PATH_SEP}${config.DS_FILENAME}`));
                f1tvUrl = await getTokenizedUrl(url, content, channel);
            }
            else {
                throw e;
            }
        }

        log.debug('tokenized url:', f1tvUrl.url);

        const useDash = (f1tvUrl.url.indexOf('m3u8') == -1);
        const includeInternationalAudio = (internationalAudio !== undefined);

        const ext = (format == "mp4") ? 'mp4' : 'ts';
        // if f1, f2, f3 race, series = content.metadata.emfAttributes.Series
        // if other, series = content.metadata.genres[0]
        const series = (isRaceSeries(content)) ? capitalizeFirstLetter(content.metadata.emfAttributes.Series.toLowerCase()) : capitalizeFirstLetter(content.metadata.emfAttributes.Series.toLowerCase()) + ' ' + content.metadata.genres[0];
        const seriesNumber = await tvdb(content.metadata.emfAttributes.Series.toLowerCase().replace(/ /g, '-'), content.metadata.year, (content.metadata.emfAttributes.sessionEndDate != undefined)?content.metadata.emfAttributes.sessionEndDate:content.properties[0].sessionEndTime, `${content.metadata.title}`);
        const nameSpec = (seriesNumber != null) ? `${series} - ${seriesNumber} - ${content.metadata.title}` : `${series} - ${content.metadata.title}`;
        const outFile = (isRace(content) && channel !== null) ? `${nameSpec}-${channel.split(' ').shift()}.${ext}` : `${nameSpec}.${ext}`;
        const outFileSpec = (outputDir !== null) ? outputDir + outFile.replace(/:/g, '-') : outFile.replace(/:/g, '-');        
        const drmStreams = new Streams([]);
        const drmStreamProgressTracker = new StreamProgressTracker();
        const mp4Metadata = [];
        if (format == "mp4") {
            mp4Metadata.push(...[
                `-metadata`, `media_type=10`,
                //`-metadata`, `show=${content.metadata.emfAttributes.Series}`, //Don't know why I can't add this
                `-metadata`, `season_number=${content.metadata.year}`,
                `-metadata`, `title=${content.metadata.title}`,
                `-metadata`, `year=${content.metadata.year}`
            ]);
            if (seriesNumber != null) {
                mp4Metadata.push(`-metadata`, `episode_id=${seriesNumber}`);
            }
        }

        if (useDash) log.info(`Using ${config.makeItGreen('DASH')}.`);

        const plDetails = await getProgramStreamId(f1tvUrl.url, audioStream, videoSize);
        log.debug(JSON.stringify(plDetails, 2, 4));
        if (useDash && plDetails.hasDRM) {
            log.info(`Found DRM Stream ${config.makeItGreen(f1tvUrl.streamType)}.`);
            log.info(`License URL: ${config.makeItGreen(f1tvUrl.laURL)}`);
            log.info(`KID: ${config.makeItGreen(plDetails.kid)}`);
            log.info(`PSSH: ${config.makeItGreen(plDetails.pssh)}`);

            try {
                const key = await getWvKeys({
                    headers: {
                        "entitlementtoken": getF1tvLoginToken()
                    },
                    licenseUrl: f1tvUrl.laURL,
                    pssh: plDetails.pssh,
                });
                log.info(`Key found: ${config.makeItGreen(key[0].key)}`);
                plDetails.key = key[0].key;
            }
            catch (e) {
                log.info(`This content is protected by Digital Rights Management.`);
                const ans = await inquirer.prompt([{
                    type: 'input',
                    name: 'key',
                    message: 'Please enter a valid decryption key to download: ',
                    validate: validKey
                }])
                log.info(`Using key: ${config.makeItGreen(ans.key)}`);
                plDetails.key = ans.key;
                if (ans.key.split(':')[0].toLowerCase() != plDetails.kid.toLowerCase()) log.info(`KID of the entered key does not match the content. Decryption may not work.`);
            }
        }

        if (streamUrl) return log.info(f1tvUrl.url);

        const programStream = plDetails.videoId;
        const audioStreamId = plDetails.audioId;
        const videoSelectFormatString = (useDash) ? '0:v:m:id:%i' : '0:p:%i:v';
        const videoSelectString = util.format(videoSelectFormatString, programStream);
        const audioSelectString = (useDash) ? '0:a' : `0:p:${programStream}:a`;

        log.debug(`Video selection: ${videoSelectString} / Audio selection: ${audioSelectString}`);

        let audioStreamMapping = ['-map', audioSelectString];
        let audioCodecParameters = ['-c:a', 'copy'];

        const inputOptions = [
            '-probesize', '24M',
            '-analyzeduration', '6M',
            '-rtbufsize', '2147M',
            //'-live_start_index', '0'
        ];

        let intlInputOptions = [...inputOptions];

        if (audioStreamId !== -1) {
            log.info(`Found audio stream that matches ${config.makeItGreen(audioStream)}.`);
            log.info(`Using audio stream id ${config.makeItGreen(audioStreamId)}.`);
        }
        else {
            log.info(`Unable to find a match for audio stream that matches ${config.makeItGreen(audioStream)}.`);
            log.info('Using default audio stream.');
        }

        if (plDetails.hasDRM && plDetails.key != undefined) {
            log.info('Prepare download of encrypted streams.');
            drmStreams.addStream(new VideoStream(f1tvUrl.url, `${nameSpec}-video.mp4`, plDetails.key, plDetails.videoId));
            drmStreams.addStream(new AudioStream(f1tvUrl.url, `${nameSpec}-audio.m4a`, plDetails.key, 'eng'))
        }

        let intlUrl;
        if (includeInternationalAudio && isRace(content)) {
            log.info(`Adding ${internationalAudio} commentary from the international feed as a second audio channel.`);
            log.debug(itsoffset);

            intlUrl = await getTokenizedUrl(url, content, 'INTERNATIONAL');
            const intlDetails = await getProgramStreamId(intlUrl.url, internationalAudio, '480x270');
            if (useDash && intlDetails.hasDRM) {
                log.info(`Using same DRM key for additional streams.`);
                intlDetails.key = plDetails.key;
                log.info(`Key found: ${config.makeItGreen(intlDetails.key)}`);
                /*
                log.info(`Found DRM Stream ${config.makeItGreen(intlUrl.streamType)}.`);
                log.info(`License URL: ${config.makeItGreen(intlUrl.laURL)}`);
                log.info(`KID: ${config.makeItGreen(intlDetails.kid)}`);
                log.info(`PSSH: ${config.makeItGreen(intlDetails.pssh)}`);
                try {
                    const key = await getWvKeys({
                        headers: {
                            "entitlementtoken": getF1tvLoginToken()
                        },
                        licenseUrl: intlUrl.laURL,
                        pssh: intlDetails.pssh,
                    });
                    log.info(`Key found: ${config.makeItGreen(key[0].key)}`);
                    intlDetails.key = key[0].key;
                }
                catch (e) {
                    log.info(`No key found. ${e.message}`);
                }
                //*/
            }

            log.debug(JSON.stringify(intlDetails, 2, 4));


            log.debug('intl url:', intlUrl.url);

            intlInputOptions.push(...[
                '-itsoffset', itsoffset,
                //'-live_start_index', '50'
            ]);

            if (intlDetails.hasDRM && intlDetails.key != undefined) {
                log.info(`Adding download of additional audio (${internationalAudio}) encrypted stream.`);
                drmStreams.addStream(new AudioStream(intlUrl.url, `${nameSpec}-audio-${internationalAudio}.m4a`, intlDetails.key, internationalAudio));
            }

            //const intlVideoSelectFormatString = (useDash) ? '1:v:m:id:%i' : '1:p:%i:v';
            //const intlVideoSelectString = util.format(intlVideoSelectFormatString, intlDetails.videoId);

            const intlAudioSelectFormatString = (useDash) ? '1:a:m:id:%i' : `1:p:${programStream}:a:%i`;
            const intlAudioSelectString = util.format(intlAudioSelectFormatString, intlDetails.audioId);

            audioStreamMapping = [
                //'-map', intlVideoSelectString,
                '-map', audioSelectString,
                '-map', intlAudioSelectString,
            ];

            let intlLangId = (internationalAudio == 'eng') ? 'Sky' : internationalAudio;

            audioCodecParameters = [
                '-c:a', 'copy',
                `-metadata:s:a:0`, `language=eng`,
                `-metadata:s:a:0`, `title=English`,
                `-disposition:a:0`, `default`,
                `-metadata:s:a:1`, `language=${intlLangId}`,
                `-metadata:s:a:1`, `title=${intlLangId}`,
                `-disposition:a:1`, `none`
            ];
        }

        log.debug(programStream);

        log.info('Output file:', config.makeItGreen(outFileSpec));

        if (plDetails.hasDRM && plDetails.key != undefined) {
            log.info(`Starting download of encrypted streams...`)
            let promises = [];
            for (const stream of drmStreams) {
                const download = new DASHDownloader(stream);
                download.on('data', (data) => {
                    drmStreamProgressTracker.update(data);
                    process.stdout.write(`\r${drmStreamProgressTracker.toString()}`);
                });
                promises.push(download.start());
            }
            let results = await Promise.all(promises);
            log.debug(results);

            process.stdout.write(`\r\ndownload complete.\nStarting decryption of streams...`);

            promises = [];
            for (const stream of drmStreams) {
                promises.push(bento4.mp4decrypt.exec(stream.decFilename, ['--key', stream.key, stream.encFilename]));
            }
            results = await Promise.all(promises);
            log.debug(results);
            log.info(`decryption complete.`);

            const streamMapping = (includeInternationalAudio && isRace(content)) ?
                [
                    '-map', '0:v',
                    '-map', '1:a',
                    '-map', '2:a',
                ] :
                [
                    '-map', '0:v',
                    '-map', '1:a',
                ];

            const options = (format == "mp4") ?
                [
                    ...streamMapping,
                    `-c:v`, 'copy',
                    ...audioCodecParameters,
                    '-bsf:a', 'aac_adtstoasc',
                    '-movflags', 'faststart',
                    ...mp4Metadata,
                    '-y'
                ] :
                [
                    ...streamMapping,
                    `-c:v`, 'copy',
                    ...audioCodecParameters,
                    '-y'
                ];


            return (includeInternationalAudio && isRace(content))
                ?
                ffmpeg()
                    .input(drmStreams[0].decFilename)
                    .input(drmStreams[1].decFilename)
                    .input(drmStreams[2].decFilename)
                    .inputOptions([
                        '-itsoffset', itsoffset
                    ])
                    .outputOptions(options)
                    .on('start', commandLine => {
                        log.info('Muxing decrypted streams:', config.makeItGreen(commandLine));
                        log.debug('Executing command:', config.makeItGreen(commandLine));
                    })
                    .on('codecData', data => {
                        log.debug(data);
                    })
                    .on('progress', info => {
                        const outStr = '\rFrames=' + config.makeItGreen(fixedLength(`${info.frames}`, 10)) + ' Fps=' + config.makeItGreen(fixedLength(`${info.currentFps}`, 5) + 'fps') + ' Kbps=' + config.makeItGreen(fixedLength(`${info.currentKbps}`, 7) + 'Kbps') + ' Duration=' + config.makeItGreen(fixedLength(`${info.timemark}`, 11)) + ' Percent Complete=' + config.makeItGreen(fixedLength(`${parseInt(info.percent)}`, 3) + '%');
                        process.stdout.write(outStr);
                    })
                    .on('end', () => {
                        log.info('\nMuxing complete.');
                    })
                    .on('error', e => {
                        log.error('ffmpeg error:', e.message);
                        log.info(e);
                    })
                    .save(outFileSpec)
                :
                ffmpeg()
                    .input(drmStreams[0].decFilename)
                    .input(drmStreams[1].decFilename)
                    .outputOptions(options)
                    .on('start', commandLine => {
                        log.info('Muxing decrypted streams:', config.makeItGreen(commandLine));
                        log.debug('Executing command:', config.makeItGreen(commandLine));
                    })
                    .on('codecData', data => {
                        log.debug(data);
                    })
                    .on('progress', info => {
                        const outStr = '\rFrames=' + config.makeItGreen(fixedLength(`${info.frames}`, 10)) + ' Fps=' + config.makeItGreen(fixedLength(`${info.currentFps}`, 5) + 'fps') + ' Kbps=' + config.makeItGreen(fixedLength(`${info.currentKbps}`, 7) + 'Kbps') + ' Duration=' + config.makeItGreen(fixedLength(`${info.timemark}`, 11)) + ' Percent Complete=' + config.makeItGreen(fixedLength(`${parseInt(info.percent)}`, 3) + '%');
                        process.stdout.write(outStr);
                    })
                    .on('end', () => {
                        log.info('\nMuxing complete.');
                    })
                    .on('error', e => {
                        log.error('ffmpeg error:', e.message);
                        log.info(e);
                    })
                    .save(outFileSpec);
        }

        const options = (format == "mp4") ?
            [
                '-map', videoSelectString,
                ...audioStreamMapping,
                `-c:v`, 'copy',
                ...audioCodecParameters,
                '-bsf:a', 'aac_adtstoasc',
                '-movflags', 'faststart',
                ...mp4Metadata,
                '-y'
            ] :
            [
                '-map', videoSelectString,
                ...audioStreamMapping,
                `-c:v`, 'copy',
                ...audioCodecParameters,
                '-y'
            ];

        return (includeInternationalAudio && isRace(content))
            ?  // Use this command when adding international audio
            ffmpeg()
                .input(f1tvUrl.url)
                .inputOptions(inputOptions)
                .input(intlUrl.url)
                .inputOptions(intlInputOptions)
                .outputOptions(options)
                .on('start', commandLine => {
                    log.debug('Executing command:', config.makeItGreen(commandLine));
                })
                .on('codecData', data => {
                    log.debug(data.video);
                    log.debug(data.audio);
                    log.info('File duration:', config.makeItGreen(data.duration), '\n');
                })
                .on('progress', info => {
                    const outStr = '\rFrames=' + config.makeItGreen(fixedLength(`${info.frames}`, 10)) + ' Fps=' + config.makeItGreen(fixedLength(`${info.currentFps}`, 5) + 'fps') + ' Kbps=' + config.makeItGreen(fixedLength(`${info.currentKbps}`, 7) + 'Kbps') + ' Duration=' + config.makeItGreen(fixedLength(`${info.timemark}`, 11)) + ' Percent Complete=' + config.makeItGreen(fixedLength(`${parseInt(info.percent)}`, 3) + '%');
                    process.stdout.write(outStr);
                })
                .on('end', () => {
                    log.info('\nDownload complete.');
                })
                .on('error', e => {
                    log.error('ffmpeg error:', e.message);
                    log.debug(e);
                })
                .save(outFileSpec)

            : // Use this command for everything else
            ffmpeg()
                .input(f1tvUrl.url)
                .inputOptions(inputOptions)
                .outputOptions(options)
                .on('start', commandLine => {
                    log.debug('Executing command:', config.makeItGreen(commandLine));
                })
                .on('codecData', data => {
                    log.debug(data.video);
                    log.debug(data.audio);
                    log.info('File duration:', config.makeItGreen(data.duration), '\n');
                })
                .on('progress', info => {
                    const outStr = '\rFrames=' + config.makeItGreen(fixedLength(`${info.frames}`, 10)) + ' Fps=' + config.makeItGreen(fixedLength(`${info.currentFps}`, 5) + 'fps') + ' Kbps=' + config.makeItGreen(fixedLength(`${info.currentKbps}`, 7) + 'Kbps') + ' Duration=' + config.makeItGreen(fixedLength(`${info.timemark}`, 11)) + ' Percent Complete=' + config.makeItGreen(fixedLength(`${parseInt(info.percent)}`, 3) + '%');
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
    catch (e) {
        
        log.error('Error:', e.message);
        log.debug(e);
    }
})();