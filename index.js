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
            channel = "INTERNATIONAL";
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
            includePitLaneAudio: includePitLaneAudio,
            itsoffset: itsoffset,
            audioStream: audioStream,
            videoSize: videoSize,
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
                        desc: 'Choose an alternate channel for a content with multiple video feeds. Use the channel-list option to see a list of channels and specify name/number/tla to select alternate channel.',
                        default: null,
                        alias: 'c'
                    })
                    .option('include-pit-lane-audio', {
                        type: 'boolean',
                        desc: 'Include the Pit Lane Channel audio stream as a secondary audio channel. (Only works for content with a Pit Lane Channel)',
                        default: false,
                        alias: 'p'
                    })
                    .option('itsoffset', {
                        type: 'string',
                        desc: 'Used to sync Pit Lane Channel Audio. Specify the time offset as \'(-)hh:mm:ss.SSS\'',
                        alias: 't',
                        default: '00:00:00.000',
                        coerce: key => {
                            const pattern = new RegExp(/^-?\d{2}:\d{2}:\d{2}\.\d{3}/);
                            if (!pattern.test(key))
                                throw new Error(`Invalid format for itsoffset: ${key}. Use (-)hh:mm:ss.SSS`);
                            return key;
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

        const useDash = (f1tvUrl.indexOf('m3u8') == -1);
        if (useDash) log.info('Using DASH.');

        const ext = (format == "mp4") ? 'mp4' : 'ts';
        const outFile = (isRace(content) && channel !== null) ? `${getContentParams(url).name}-${channel.split(' ').shift()}.${ext}` : `${getContentParams(url).name}.${ext}`;
        const outFileSpec = (outputDir !== null) ? outputDir + outFile : outFile;

        const plDetails = await getProgramStreamId(f1tvUrl, audioStream, videoSize);
        log.debug(JSON.stringify(plDetails, 2, 4));

        const programStream = plDetails.videoId;
        const audioStreamId = plDetails.audioId;
        const useDefaultAudio = (audioStreamId == -1);
        const videoSelectFormatString = (useDash) ? '0:v:m:id:%i' : '0:p:%i:v';
        const dashFormatString = (useDefaultAudio) ? '0:a' : '0:a:m:id:%i';
        const hlsFormatString = (useDefaultAudio) ? `0:p:${programStream}:a` : `0:p:${programStream}:a:%i`;
        const audioSelectFormatString = (useDash) ? dashFormatString : hlsFormatString;

        const videoSelectString = util.format(videoSelectFormatString, programStream);
        const audioSelectString = util.format(audioSelectFormatString, audioStreamId);

        log.debug(`Video selection: ${videoSelectString} / Audio selection: ${audioSelectString}`);
 
        let audioStreamMapping =  ['-map', audioSelectString];
        let audioCodecParameters = ['-c:a', 'copy'];

        const inputOptions = [
            '-probesize', '24M',
            '-analyzeduration', '6M',
            '-rtbufsize', '2147M',
            //'-live_start_index', '0'
        ];

        let pitInputOptions = [...inputOptions];

        if (audioStreamId !== -1) {
            log.info(`Found audio stream that matches ${config.makeItGreen(audioStream)}.`);
            log.info(`Using audio stream id ${config.makeItGreen(audioStreamId)}.`);
        }
        else {
            log.info(`Unable to find a match for audio stream that matches ${config.makeItGreen(audioStream)}.`);
            log.info('Using default audio stream.');
        }

        /*
        if (isRace(content)) {
            log.info(`Downsampling race audio to 48kHz for maximum compatibility.`);
        }
        */

        let pitUrl = await getTokenizedUrl(url, content, 'F1 LIVE');
        if (includePitLaneAudio && isRace(content)) {
            log.info(`Adding Pit Lane Channel audio as second audio channel.`);

            log.debug('pit url:', pitUrl);

            pitInputOptions.push(...[
                '-itsoffset', itsoffset,
                //'-live_start_index', '50'
            ]);

            audioStreamMapping = [
                '-map', audioSelectString,
                '-map', `1:a:0`,
            ];

            audioCodecParameters = [
                '-c:a', 'copy',
                `-metadata:s:a:0`, `language=${audioStream}`,
                `-disposition:a:0`, `0`,
                `-metadata:s:a:1`, 'language=lat',
                `-disposition:a:1`, `default`
            ];
        }

        log.debug(programStream);

        log.info('Output file:', config.makeItGreen(outFileSpec));

        //process.exit(0);

        // ffmpeg -i "" -itsoffset -00:00:01.350 -i "" -c copy -map 0:p:5:v -map -0:p:5:a:m:language:eng -map 1:p:0:a -metadata:s:a:0 language=eng -metadata:s:a:1 language=lat test.ts



        const options = (format == "mp4") ?
            [
                '-map', videoSelectString,
                ...audioStreamMapping,
                `-c:v`, 'copy',
                ...audioCodecParameters,
                //'-bsf:a', 'aac_adtstoasc',
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



        return (includePitLaneAudio && isRace(content))
            ?  // Use this command when adding pitlane audio
            ffmpeg()
                .input(f1tvUrl)
                .inputOptions(inputOptions)
                .input(pitUrl)
                .inputOptions(pitInputOptions)
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