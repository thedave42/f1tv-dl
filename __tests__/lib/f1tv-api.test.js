const config = require('../../lib/config');
const { getContentParams, getContentInfo, getContentStreamUrl, getChannelIdFromPlaybackUrl, getAdditionalStreamsInfo } = require('../../lib/f1tv-api');

const raceUrl = process.env.RACEURL;
const episodeUrl = process.env.EPISODEURL;
const raceName = process.env.RACENAME;
const raceId = process.env.RACEID;
const episodeName = process.env.EPISODENAME;
const episodeId = process.env.EPISODEID;
const raceChannelIdData = process.env.RACECHANNELID_DATA;
const raceChannelIdHam = process.env.RACECHANNELID_HAM;

test('Check for valid race name', () => {
    const params = getContentParams(raceUrl);
    expect(params.name).toBe(raceName);
});

test('Check for valid race id', () => {
    const params = getContentParams(raceUrl);
    expect(params.id).toBe(raceId);
});

test('Check for valid episode name', () => {
    const params = getContentParams(episodeUrl);
    expect(params.name).toBe(episodeName);
});

test('Check for valid episode id', () => {
    const params = getContentParams(episodeUrl);
    expect(params.id).toBe(episodeId);
});

test('Validate altername race data stream', async () => {
    const content = await getContentInfo(raceUrl);
    const stream  = getAdditionalStreamsInfo(content.metadata.additionalStreams, 'data');
    const contentParams = getContentParams(raceUrl);
    const channelId = getChannelIdFromPlaybackUrl(stream.playbackUrl);
    expect(channelId).toBe(raceChannelIdData);
});

test('Validate altername driver data stream', async () => {
    const content = await getContentInfo(raceUrl);
    const stream  = getAdditionalStreamsInfo(content.metadata.additionalStreams, 'ham');
    const contentParams = getContentParams(raceUrl);
    const channelId = getChannelIdFromPlaybackUrl(stream.playbackUrl);
    expect(channelId).toBe(raceChannelIdHam);
});

