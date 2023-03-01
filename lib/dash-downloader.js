const config = require('./config');
const axios = require('./f1tv-axios');
const fs = require('fs');
const DASH = require('mpd-parser');
const EVENTS = require('events');
const TEMP = require('temp').track();
const PATH = require('path');
const { iso_639_1, iso_639_2 } = require('iso-639');
const bento4Bin = require('@wickednesspro/bento4-latest');
const bento4 = require('fluent-bento4')({ bin: bento4Bin.binPath });

const tempDir = TEMP.mkdirSync('dash-downloader-');

const sleep = async (millis) => {
    return new Promise(resolve => setTimeout(resolve, millis));
};

const downloadDASHSegment = async (url, file, appendedFile, key = null, flushFile = null) => {
    return new Promise((resolve, reject) => {
        const fileStream = fs.createWriteStream(file);
        fileStream.on('open', () => {
            axios.get(url, { responseType: 'stream' })
                .then(response => {
                    response.data.pipe(fileStream);
                })
                .catch(err => {
                    reject({
                        message: `${err.message}`
                    });
                });
        })
        fileStream.on('finish', () => {
            const stats = {
                path: file,
                url: url,
                appendedFile: appendedFile,
                bytesDownloaded: fileStream.bytesWritten,
                bytesOnDisk: fs.statSync(file).size
            };
            fileStream.close();
            if (file.indexOf('init') > -1) {
                fs.writeFileSync(`${appendedFile}`, fs.readFileSync(file));
            }
            else {
                try {
                    fs.accessSync(appendedFile, fs.constants.W_OK);
                    fs.appendFileSync(`${appendedFile}`, fs.readFileSync(file));
                }
                catch (e) {
                    // Try again
                    try {
                        fs.accessSync(appendedFile, fs.constants.W_OK);
                        fs.appendFileSync(`${appendedFile}`, fs.readFileSync(file));
                    }
                    catch (err) {
                        reject({
                            message: err.message
                        });
                    }
                }
            }
            fs.unlinkSync(file);
            if (flushFile != null && key != null) {
                const encTemp = TEMP.path(PATH.parse(appendedFile).name);
                fs.copyFileSync(`${appendedFile}`, `${encTemp}`);
                Promise.all([
                    (async () => {
                        await bento4.mp4decrypt.exec(flushFile, ['--key', key, encTemp]);
                        fs.rmSync(encTemp);
                    })()
                ]);
            }
            resolve(stats);
        });
        fileStream.on('error', (err) => {
            reject({
                message: err.message
            });
        });
    });
}

const downloadDASHVideoStream = async (stream, emitter, startSegment = 0) => {
    const mpdUrl = new URL(stream.url);
    const baseUrl = `${mpdUrl.origin}${mpdUrl.pathname.replace(/([^/]*)$/, '')}`;

    const uri = stream.url;
    let res = await axios.get(uri);
    let pl = DASH.parse(res.data, { uri });

    let segments = pl.playlists.find(playlist => playlist.attributes.NAME == stream.index).segments;

    let i = startSegment;
    let segment = segments.find(segment => segment.number == i);

    do {
        if (segment != undefined && segment.map.uri != undefined && i == 0) {
            let stats = await downloadDASHSegment(`${baseUrl}${segment.map.uri}`, `${tempDir}/dash-video-${stream.id}-init.mp4`, stream.encFilename);
            emitter.emit('data', {
                stream: stream,
                segmentNumber: i,
                totalSegments: segments.length,
                stats: stats
            });
        }

        const segmentUrl = `${baseUrl}${segment.uri}`;

        let stats = await downloadDASHSegment(segmentUrl, `${tempDir}/dash-video-${stream.id}-seg-${i.toString().padStart(6, '0')}.mp4`, stream.encFilename);
        emitter.emit('data', {
            stream: stream,
            segmentNumber: i,
            totalSegments: segments.length,
            stats: stats
        });
        i++;

        segment = segments.find(segment => segment.number == i);

        if (i > segments.length || segment == undefined) {
            emitter.emit('data', {
                stream: stream,
                segmentNumber: i,
                totalSegments: segments.length,
                stats: stats
            });

            if (segment == undefined) {
                await sleep(5000);
            }

            res = await axios.get(uri);
            pl = DASH.parse(res.data, { uri, previousManifest: pl });
            segments = pl.playlists.find(playlist => playlist.attributes.NAME == stream.index).segments;
            segment = segments.find(segment => segment.number == i);
        }
    }
    while (segment != undefined);
    const size = fs.statSync(stream.encFilename).size
    const finalStats = {
        stream: stream,
        segmentNumber: i,
        totalSegments: segments.length,
        stats: {
            path: stream.encFilename,
            url: stream.url,
            appendedFile: stream.encFilename,
            bytesDownloaded: size,
            bytesOnDisk: size
        }
    };
    emitter.emit('data', finalStats);
    return finalStats;
}

const downloadDASHAudioStream = async (stream, emitter, startSegment) => {
    const mpdUrl = new URL(stream.url);
    const baseUrl = `${mpdUrl.origin}${mpdUrl.pathname.replace(/([^/]*)$/, '')}`;
    const lang = (iso_639_1[stream.lang] != undefined) ? iso_639_1[stream.lang] : iso_639_2[stream.lang];

    const uri = stream.url;
    let res = await axios.get(uri);
    let pl = DASH.parse(res.data, { uri });

    let segments = Object.entries(pl.mediaGroups.AUDIO.audio).find(track => (track[1].language == lang['639-2'] || track[1].language == lang['639-1']))[1].playlists[0].segments;

    let i = startSegment;
    let segment = segments.find(segment => segment.number == i);

    do {
        if (segment != undefined && segment.map.uri != undefined && i == 0) {
            let stats = await downloadDASHSegment(`${baseUrl}${segment.map.uri}`, `${tempDir}/dash-audio-${stream.id}-init.m4a`, stream.encFilename);
            emitter.emit('data', {
                stream: stream,
                segmentNumber: i,
                totalSegments: segments.length,
                stats: stats
            });
        }

        const segmentUrl = `${baseUrl}${segment.uri}`;

        let stats = await downloadDASHSegment(segmentUrl, `${tempDir}/dash-audio-${stream.id}-seg-${i.toString().padStart(6, '0')}.m4a`, stream.encFilename);
        emitter.emit('data', {
            stream: stream,
            segmentNumber: i,
            totalSegments: segments.length,
            stats: stats
        });
        i++;

        segment = segments.find(segment => segment.number == i);

        if (i > segments.length || segment == undefined) {
            emitter.emit('data', {
                stream: stream,
                segmentNumber: i,
                totalSegments: segments.length,
                stats: stats
            });
            
            if (segment == undefined) {
                await sleep(5000);
            }

            res = await axios.get(uri);
            pl = DASH.parse(res.data, { uri, previousManifest: pl });
            segments = Object.entries(pl.mediaGroups.AUDIO.audio).find(track => (track[1].language == lang['639-2'] || track[1].language == lang['639-1']))[1].playlists[0].segments;
            segment = segments.find(segment => segment.number == i);
        }
    }
    while (segment != undefined);
    const size = fs.statSync(stream.encFilename).size
    const finalStats = {
        stream: stream,
        segmentNumber: i,
        totalSegments: segments.length,
        stats: {
            path: stream.encFilename,
            url: stream.url,
            appendedFile: stream.encFilename,
            bytesDownloaded: size,
            bytesOnDisk: size
        }
    };
    emitter.emit('data', finalStats);
    return finalStats;
}

class DASHDownloader extends EVENTS.EventEmitter {

    constructor(stream, startSegment = 0) {
        super();
        this._stream = stream;
        this._startSegment = startSegment;
    }

    start() {
        return (this._stream.type == 'video') ? downloadDASHVideoStream(this._stream, this, this._startSegment) : downloadDASHAudioStream(this._stream, this, this._startSegment);
    }
}

module.exports = DASHDownloader;