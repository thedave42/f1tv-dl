const config = require('./lib/config');

const yargs = require('yargs');
const log = require('loglevel');
const ffmpeg = require('@thedave42/fluent-ffmpeg');
const inquirer = require('inquirer');

// eventually make this an arguement
const itsoffset = '-00:00:01.350';

const { isF1tvUrl, isRace } = require('./lib/f1tv-validator');
const { getContentInfo, getContentStreamUrl, getChannelIdFromPlaybackUrl, getAdditionalStreamsInfo, getContentParams, saveF1tvToken, getProgramStreamId } = require('./lib/f1tv-api');

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
    if (isRace(content) && channel !== null) {
        const stream = getAdditionalStreamsInfo(content.metadata.additionalStreams, channel);
        const contentParams = getContentParams(url);
        const channelId = getChannelIdFromPlaybackUrl(stream.playbackUrl);
        f1tvUrl = await getContentStreamUrl(contentParams.id, channelId);
    }
    else {
        const contentParams = getContentParams(url);
        f1tvUrl = await getContentStreamUrl(contentParams.id);
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
                        desc: 'Choose an alternate channel for a race or race replay. Use the channel-list option to see a list of channels and specify name/number/tla to stream alternate channel.',
                        default: null,
                        alias: 'c'
                    })
                    .option('include-pit-lane-audio', {
                        type: 'boolean',
                        desc: 'Include the Pit Lane Channel audio stream as a secondary audio channel. (Only works for races)',
                        default: false,
                        alias: 'p'
                    })
                    .option('audio-stream', {
                        type: 'string',
                        desc: 'Specify audio stream language to download',
                        default: 'eng',
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
        const ext = (format == "mp4") ? 'mp4' : 'ts';
        const outFile = (isRace(content) && channel !== null) ? `${getContentParams(url).name}-${channel.split(' ').shift()}.${ext}` : `${getContentParams(url).name}.${ext}`;
        const outFileSpec = (outputDir !== null) ? outputDir + outFile : outFile;

        const [programStream, audioStreamId] = await getProgramStreamId(f1tvUrl, audioStream);
        let audioStreamMapping = (audioStreamId !== -1) ? ['-map', `0:p:${programStream}:a:${audioStreamId}`] : ['-map', `0:p:${programStream}:a`];
        //let audioCodecParameters = (false) ? ['-c:a', 'aac', '-ar', '48000', '-b:a', '256k'] : ['-c:a', 'copy']; // leaving this in case they switch races back to 96kHz audio
        let audioCodecParameters = ['-c:a', 'copy'];
        let inputOptions = [
            '-probesize', '24M',
            '-rtbufsize', '2147M'
        ];

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

        let pitUrl = await getTokenizedUrl(url, content, 'pit');
        if (includePitLaneAudio && isRace(content)) {
            log.info(`Adding Pit Land Channel audio as secondary audio channel.`);

            

            log.debug('pit url:', pitUrl);

            inputOptions.push(...[
                '-itsoffset', itsoffset,
            ]);

            audioStreamMapping = [
                '-map', `0:p:${programStream}:a:${audioStreamId}`,
                '-map', `1:a:0`,
            ];
            
            audioCodecParameters = [
                '-c:a', 'copy',
                //`-c:0:p:${programStream}:a:${audioStreamId}`, 'aac',
                //`-ar:0:p:${programStream}:a:${audioStreamId}`, '48000',
                //`-b:0:p:${programStream}:a:${audioStreamId}`, '256k',
                //`-c:1:a:0`, 'copy'
                `-metadata:s:a:0`, `language=${audioStream}`,
                `-metadata:s:a:1`, 'language=tld'
            ];

        }

        log.debug(programStream);

        log.info('Output file:', config.makeItGreen(outFileSpec));

        //process.exit(0);

        // ffmpeg -i "" -itsoffset -00:00:01.350 -i "" -c copy -map 0:p:5:v -map -0:p:5:a:m:language:eng -map 1:p:0:a -metadata:s:a:0 language=eng -metadata:s:a:1 language=tld test.ts



        const options = (format == "mp4") ?
            [
                '-map', `0:p:${programStream}:v`,
                ...audioStreamMapping,
                `-c:v`, 'copy',
                ...audioCodecParameters,
                '-bsf:a', 'aac_adtstoasc',
                '-movflags', 'faststart',
                '-y'
            ] :
            [
                '-map', `0:p:${programStream}:v`,
                ...audioStreamMapping,
                `-c:v`, 'copy',
                ...audioCodecParameters,
                '-y'
            ];



        return ffmpeg()
            .input(f1tvUrl)
            .input(pitUrl)
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