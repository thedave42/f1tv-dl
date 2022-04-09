#!/usr/bin/env node
const config = require('./lib/config');

const yargs = require('yargs');
const log = require('loglevel');
const ffmpeg = require('@thedave42/fluent-ffmpeg');
const inquirer = require('inquirer');
const util = require('util');

const { isF1tvUrl, isRace } = require('./lib/f1tv-validator');
const { getContentInfo, getContentStreamUrl, getAdditionalStreamsInfo, getContentParams, saveF1tvToken, getProgramStreamId } = require('./lib/f1tv-api');

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
            channel = "F1 LIVE";
        let stream = getAdditionalStreamsInfo(content.metadata.additionalStreams, channel);
        let channelId = (stream.playbackUrl !== null && stream.playbackUrl.indexOf('channelId') == -1) ? null : stream.channelId;
        f1tvUrl = await getContentStreamUrl(content.id, channelId);
    }
    return f1tvUrl;
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
            username: f1Username,
            password: f1Password,
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
                        default: '-00:00:04.750',
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
                log.info('Authorization token encrypted and stored for future use at:', config.makeItGreen(`${config.HOME}${config.PATH_SEP}${config.DS_FILENAME}`));
                f1tvUrl = await getTokenizedUrl(url, content, channel);
            }
            else {
                throw e;
            }
        }

        log.debug('tokenized url:', f1tvUrl);
        if (streamUrl) return log.info(f1tvUrl);

        const useDash = (f1tvUrl.indexOf('m3u8') == -1);
        const includeInternationalAudio = (internationalAudio !== undefined);

        if (useDash) log.info('Using DASH.');

        const ext = (format == "mp4") ? 'mp4' : 'ts';
        const outFile = (isRace(content) && channel !== null) ? `${getContentParams(url).name}-${channel.split(' ').shift()}.${ext}` : `${getContentParams(url).name}.${ext}`;
        const outFileSpec = (outputDir !== null) ? outputDir + outFile : outFile;

        const plDetails = await getProgramStreamId(f1tvUrl, audioStream, videoSize);
        log.debug(JSON.stringify(plDetails, 2, 4));


        const programStream = plDetails.videoId;
        const audioStreamId = plDetails.audioId;
        const videoSelectFormatString = (useDash) ? '0:v:m:id:%i' : '0:p:%i:v';
        const videoSelectString = util.format(videoSelectFormatString, programStream);
        const audioSelectString = (useDash) ? '0:a' : `0:p:${programStream}:a`;

        log.debug(`Video selection: ${videoSelectString} / Audio selection: ${audioSelectString}`);
 
        let audioStreamMapping =  ['-map', audioSelectString];
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

        let intlUrl;
        if (includeInternationalAudio && isRace(content)) {
            log.info(`Adding ${internationalAudio} commentary from the international feed as a second audio channel.`);
            log.debug(itsoffset);

            intlUrl = await getTokenizedUrl(url, content, 'INTERNATIONAL');
            const intlDetails = await getProgramStreamId(intlUrl, internationalAudio, '480x270');

            log.debug(JSON.stringify(intlDetails, 2, 4));


            log.debug('intl url:', intlUrl);

            intlInputOptions.push(...[
                '-itsoffset', itsoffset,
                //'-live_start_index', '50'
            ]);

            const intlVideoSelectFormatString = (useDash) ? '1:v:m:id:%i' : '1:p:%i:v';
            const intlVideoSelectString = util.format(intlVideoSelectFormatString, intlDetails.videoId);

            const intlAudioSelectFormatString = (useDash) ? '1:a:m:id:%i' : `1:p:${programStream}:a:%i`;
            const intlAudioSelectString = util.format(intlAudioSelectFormatString, intlDetails.audioId);

            audioStreamMapping = [
                '-map', intlVideoSelectString,
                '-map', audioSelectString,
                '-map', intlAudioSelectString,
            ];

            let intlLangId = (internationalAudio == 'eng') ? 'Sky' : internationalAudio;

            audioCodecParameters = [
                '-c:a', 'copy',
                `-metadata:s:a:0`, `language=eng`,
                `-disposition:a:0`, `default`,
                `-metadata:s:a:1`, `language=${intlLangId}`,
                `-disposition:a:1`, `0`
            ];
        }

        log.debug(programStream);

        log.info('Output file:', config.makeItGreen(outFileSpec));

        const options = (format == "mp4") ?
            [
                '-map', videoSelectString,
                ...audioStreamMapping,
                `-c:v`, 'copy',
                ...audioCodecParameters,
                '-bsf:a', 'aac_adtstoasc',
                '-movflags', 'faststart',
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
                .input(f1tvUrl)
                .inputOptions(inputOptions)
                .input(intlUrl)
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
                .save(outFileSpec)

            : // Use this command for everything else
            ffmpeg()
                .input(f1tvUrl)
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
    catch (e) {
        log.error('Error:', e.message);
        log.debug(e);
    }
})();