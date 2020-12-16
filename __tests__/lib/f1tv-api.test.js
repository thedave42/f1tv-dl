const config = require('../../lib/config');
const { getSlugName, getEpisodeUrl, getSessionUrl } = require('../../lib/f1tv-api');

const raceUrl = process.env.RACEURL;
const episodeUrl = process.env.EPISODEURL;
const raceSlug = process.env.RACESLUG;
const episodeSlug = process.env.EPISODESLUG;
const validEpisodeUrl = process.env.VALIDEPISODEURL;
const validRaceSessionUrl = process.env.VALIDRACESESSIONURL;
const validHAMSessionUrl = process.env.VALIDHAMSESSIONURL;

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