const config = require('./config');
const PATH = require('path');
const TEMP = require('temp');
const EVENTS = require('events');
const prettyBytes = require('pretty-bytes-es5');

function Classes(bases) {
    class Bases {
        constructor() {
            bases.forEach(base => Object.assign(this, new base()));
        }
    }
    bases.forEach(base => {
        Object.getOwnPropertyNames(base.prototype)
            .filter(prop => prop != 'constructor')
            .forEach(prop => Bases.prototype[prop] = base.prototype[prop])
    })
    return Bases;
}

/**
 * Class for maintaining Array of Streams
 */
class Streams extends Array {

    constructor(streams) {
        super();
        streams.forEach(stream => this.addStream(stream));
    }

    addStream(stream) {
        stream.id = this.length;
        this.push(stream);
    }
}

/**
 * Base class representing a media stream
 */
class Stream {

    /**
     * Create a new stream object
     * 
     * @param {string} url - The url to the stream
     * @param {string} outfile - The name of the local file to output the stream
     * @param {string} key - A key for stream decryption
     */
    constructor(url, outfile, key = null) {
        this._url = url;
        this._outfile = outfile;
        this._filespec = PATH.parse(outfile);
        this._key = (key != null) ? key : null;
        this._type = 'stream';
        this._id = -1;
        this._part = 1;
        this._encFilename = `${this._filespec.name}-encrypted-pt${this._part}${this._filespec.ext}`;
        this._decFilename = `${this._filespec.name}-decrypted-pt${this._part}${this._filespec.ext}`;
        this._encFileParts = [];
        this._decFileParts = [];
    }

    /** Test if two Stream objects are equal
     * 
     * @param {Stream} other - The other stream to compare to
     * @returns {boolean} True if the streams are equal
     */
    equals(other) {
        return (this.url == other.url && this.outfile == other.outfile && this.type == other.type);
    }

    /**
     * Get the url to the stream
     * 
     * @returns {string} The url to the stream
     */
    get url() {
        return this._url;
    }

    /**
     * Get the name of the local file to output the stream
     * 
     * @returns {string} The name of the local file to output the stream
     * @memberof Stream
     */
    get outfile() {
        return this._outfile;
    }

    /**
     * Get the key for stream decryption
     * 
     * @returns {string} The key for stream decryption
     * @memberof Stream
     */
    get key() {
        return this._key;
    }

    /**
     * Get the type of the stream
     * 
     * @returns {string} The type of the stream
     * @memberof Stream
     */
    get type() {
        return this._type;
    }

    /**
     * Set the stream id
     * 
     * @param {number} id - The id of the stream
     * @memberof Stream
     */
    set id(id) {
        this._id = id;
    }

    /**
     * Get the id of the stream
     * 
     * @returns {number} The id of the stream
     * @memberof Stream
     */
    get id() {
        return this._id;
    }

    /**
     * Get the temp file name for the encrypted stream
     * 
     * @returns {string} The temp file name for the encrypted stream
     * @memberof Stream
     */
    get encFilename() {
        return this._encFilename;
    }

    /**
     * Get the number of parts that the encrypted file is split into
     * 
     * @returns {number} The number of parts that the encrypted file is split into
     * @memberof Stream
     */
    get encFileParts() {
        return this._encFileParts;
    }

    /**
     * Get the temp file name for the decrypted stream
     * 
     * @returns {string} The temp file name for the decrypted stream
     * @memberof Stream
     */
    get decFilename() {
        return this._decFilename;
    }

    /**
     * Get the number of parts that the decrypted file is split into
     * 
     * @returns {number} The number of parts that the decrypted file is split into
     * @memberof Stream
     */
    get decFileParts() {
        return this._decFileParts;
    }

    /**
     * Get the current part number
     * 
     * @returns {number} The current part number
     * @memberof Stream
     */
    get partsCount() {
        return this._part;
    }

    /**
     * Move to the next part
     * 
     * @memberof Stream
     */
    nextPart() {
        this._encFileParts.push(this._encFilename);
        this._decFileParts.push(this._decFilename);
        this._part++;
        this._encFilename = `${this._filespec.name}-encrypted-pt${this._part}${this._filespec.ext}`;
        this._decFilename = `${this._filespec.name}-decrypted-pt${this._part}${this._filespec.ext}`;
    }
}

/**
 * Class representing a video stream
 */
class VideoStream extends Stream {

    /**
     * Create a new VideoStream object
     * 
     * @param {*} url - The url to the stream
     * @param {*} outfile - The name of the local file to output the stream
     * @param {*} key - A key for stream decryption
     * @param {*} index - The program index of the video stream from the source
     * 
     * @memberof VideoStream
     */
    constructor(url, outfile, key = null, index) {
        super(url, outfile, key);
        this._index = index;
        this._type = 'video';
        this._encFilename = TEMP.path({ prefix: `encrypted-`, suffix: `-video-pt${this._part}.mp4` });
        this._decFilename = TEMP.path({ prefix: `decrypted-`, suffix: `-video-pt${this._part}.mp4` });
    }

    /**
     * Generate a temporary file name for a flush file
     * 
     * @param {*} id - Any string that identifies the flush file
     * @returns a temporary file name for a flush file
     * @memberof VideoStream
     */
    flushFilename(id) {
        return `${this._filespec.name}-flushed-${id}-video-pt${this._part}.mp4`;
    }

    /**
     * Get the index of the video stream
     * 
     * @returns {number} The index of the video stream
     * @memberof VideoStream
     */
    get index() {
        return this._index;
    }

    /** 
     * Move to the next part
     * 
     * @memberof VideoStream
     */
    nextPart() {
        this._encFileParts.push(this._encFilename);
        this._decFileParts.push(this._decFilename);
        this._part++
        this._encFilename = TEMP.path({ prefix: `encrypted-`, suffix: `-video-pt${this._part}.mp4` });
        this._decFilename = TEMP.path({ prefix: `decrypted-`, suffix: `-video-pt${this._part}.mp4` });
    }
}

/** Class that represents an AudioStream */
class AudioStream extends Stream {

    /**
     * Create a new AudioStream object
     * 
     * @param {*} url - The url to the stream
     * @param {*} outfile - The name of the local file to output the stream
     * @param {*} key - A key for stream decryption
     * @param {*} lang - The language of the audio stream
     * 
     * @memberof AudioStream
     */
    constructor(url, outfile, key = null, lang) {
        super(url, outfile, key);
        this._lang = lang;
        this._type = 'audio';
        this._encFilename = TEMP.path({ prefix: `encrypted-`, suffix: `-audio-pt${this._part}.m4a` });
        this._decFilename = TEMP.path({ prefix: `decrypted-`, suffix: `-audio-pt${this._part}.m4a` });
    }

    /**
     * Generate a temporary file name for a flush file
     * 
     * @param {*} id - Any string that identifies the flush file
     * @returns a temporary file name for a flush file
     * @memberof AudioStream
     */
    flushFilename(id) {
        return `${this._filespec.name}-flushed-${id}-audio-pt${this._part}.m4a`;
    }

    /**
     * Get the language of the audio stream
     * 
     * @returns {string} The language of the audio stream
     * @memberof AudioStream
     */
    get lang() {
        return this._lang;
    }

    /**
     * Move to the next part
     * 
     * @memberof AudioStream
     */
    nextPart() {
        this._encFileParts.push(this._encFilename);
        this._decFileParts.push(this._decFilename);
        this._part++
        this._encFilename = TEMP.path({ prefix: `encrypted-`, suffix: `-audio-pt${this._part}.m4a` });
        this._decFilename = TEMP.path({ prefix: `decrypted-`, suffix: `-audio-pt${this._part}.m4a` });
    }
}

class MuxQueueManager extends Classes([Array, EVENTS.EventEmitter]) {

    addItem(item) {
        const isVideo = (item.match(/-video/) != null);
        const otherItem = (isVideo) ? item.replace(/-video/, '-audio').replace(/\.mp4/, '.m4a') : item.replace(/-audio/, '-video').replace(/\.m4a/, '.mp4');
        const haveOtherItem = (this.findIndex(i => i == otherItem) != -1);

        if (haveOtherItem) {
            this.emit('match', { video: `${(isVideo) ? item : otherItem}`, audio: `${(isVideo) ? otherItem : item}` });
            this.pop();
        }
        else {
            this.push(item);
        }
    }
}

class StreamProgressTracker {

    constructor() {
        this._items = [];
    }

    update(data) {
        const index = this._items.findIndex(item => item.id == data.stream.id);
        if (index > -1) {
            this._items[index].segment = data.segmentNumber;
            this._items[index].total = data.totalSegments;
            this._items[index].bytesDownloaded += data.stats.bytesDownloaded;
        }
        else {
            this._items.push({
                id: data.stream.id,
                type: data.stream.type,
                segment: data.segmentNumber,
                total: data.totalSegments,
                bytesDownloaded: data.stats.bytesDownloaded,
            });
        }

    }

    toString() {
        let progressDisplay = [];
        this._items.sort(
            (a, b) => {
                if (a.id < b.id) {
                    return -1;
                }
                if (a.id > b.id) {
                    return 1;
                }
                return 0;
            }
        ).forEach(item => {
            progressDisplay.push(`${item.type} (${item.id}): `.padStart('12', ' ') + config.makeItGreen(`${String(item.segment).padStart('4', ' ')}/${String(item.total).padStart('4', ' ')} (${prettyBytes(item.bytesDownloaded).padStart(7, ' ')})`));
        });
        return progressDisplay.join(' ');
    }
}


/*
class StreamEventEmitter extends EVENTS.EventEmitter {

    constructor() {

        super();
    }
}
*/

module.exports = {
    Streams,
    Stream,
    VideoStream,
    AudioStream,
    MuxQueueManager,
    StreamProgressTracker
}