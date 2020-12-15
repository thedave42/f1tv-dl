const { getSlugName, getEpisodeUrl, getSessionUrl } = require('../../lib/f1tv-api');

const raceUrl = 'https://f1tv.formula1.com/en/current-season/abu-dhabi-grand-prix/2020-abu-dhabi-grand-prix-formula-1-race';
const episodeUrl = 'https://f1tv.formula1.com/en/episode/watch-along-e03-2008-brazilian-gp-the-championship-showdown';
const raceSlug = '2020-abu-dhabi-grand-prix-formula-1-race';
const episodeSlug = 'watch-along-e03-2008-brazilian-gp-the-championship-showdown';
const validEpisodeUrl = '/api/assets/asse_8a0abdba63614b1b9f2115165c746c80/';
const validRaceSessionUrl = '/api/channels/chan_30bbe36c6a0b4c299fc2dab177ac7e7b/';
const validHAMSessionUrl = '/api/channels/chan_d4b5c3cf47d74258b1049994786028a9/';

test('Test for valid race url slug', () => {
    expect(getSlugName(raceUrl)).toBe(raceSlug);
});

test('Test for valid episode url slug', () => {
    expect(getSlugName(episodeUrl)).toBe(episodeSlug);
});

test('Test for valid episode URL', () => {
    return getEpisodeUrl(episodeUrl)
        .then( (url) => {
            expect(url).toBe(validEpisodeUrl);      
        });
});

test('Test for valid race sessionURL', () => {
    return getSessionUrl(raceUrl)
        .then( (url) => {
            expect(url).toBe(validRaceSessionUrl);      
        });
});

test('Test for single driver (HAM) cockpit view sessionURL', () => {
    return getSessionUrl(raceUrl, 'HAM')
        .then( (url) => {
            expect(url).toBe(validHAMSessionUrl);      
        });
});