const config = require('./lib/config');

const yargs = require('yargs');
const log = require('loglevel');
const ffmpeg = require('@thedave42/fluent-ffmpeg');
const inquirer = require('inquirer');

const { isF1tvUrl, isRace } = require('./lib/f1tv-validator');
const { getContentInfo, getContentStreamUrl, getChannelIdFromPlaybackUrl, getAdditionalStreamsInfo, getContentParams, saveF1tvToken, getProgramStreamId } = require('./lib/f1tv-api');

const getSessionChannelList = (url) => {
    getContentInfo(url)
        .then( result => {
            if (isRace(result)) {
                for ( const stream of result.metadata.additionalStreams ) {
                    const data = (stream.type === 'obc')?`name: ${config.makeItGreen(stream.driverFirstName+' '+stream.driverLastName)}`.padEnd(37) + `number: ${config.makeItGreen(stream.racingNumber)}`.padEnd(22) + `tla: ${config.makeItGreen(stream.title)}`:`name: ${config.makeItGreen(stream.title)}`;
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
        const stream  = getAdditionalStreamsInfo(content.metadata.additionalStreams, channel);
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
                        desc: 'Choose an alternate channel for a race or race replay. Use the channel-list option to see a list of channels and specify name/number/tla to stream alternate channel.',
                        default: null,
                        alias: 'c'
                    })
                    .option('program-stream', {
                        type: 'string',
                        desc: 'Specify the program for the video stream',
                        default: '5',
                        alias: 'v'
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
                if (f1Username == null || f1Password == null ) {
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
        const outFile = (isRace(content) && channel !== null) ?`${getContentParams(url).name}-${channel.split(' ').shift()}.${ext}`:`${getContentParams(url).name}.${ext}`;
        const outFileSpec = (outputDir !== null) ? outputDir + outFile : outFile;

        programStream = await getProgramStreamId(f1tvUrl);

        log.debug(programStream);

        //process.exit(0);

        log.info('Output file:', config.makeItGreen(outFileSpec));
        const options = (format == "mp4") ?
            [
                //'-c', 'copy',
                //'-bsf:a', 'aac_adtstoasc',
                '-c:v', 'copy',
                '-c:a', 'aac', '-ar', '48000', '-b:a', '256k',
                '-movflags', 'faststart',
                '-map', `0:p:${programStream}:v`,
                '-map', `0:m:language:${audioStream}`,
                '-y'
            ] :
            [
                //'-c', 'copy',
                '-c:v', 'copy',
                '-c:a', 'aac', '-ar', '48000', '-b:a', '256k',
                '-map', `0:p:${programStream}:v`,
                '-map', `0:m:language:${audioStream}`,
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
    catch (e) {
        log.error('Error:', e.message);
        log.debug(e);
    }
})();