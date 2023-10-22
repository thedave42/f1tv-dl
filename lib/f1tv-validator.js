// Helper consts for f1tv-dl app
//

const isUrl = (string) => {
    try { return Boolean(new URL(string));}
    catch (e) { return false; }
}

const isF1tvUrl = (urlStr) => {
    try {
        if (isUrl(urlStr)) {
            let url = new URL(urlStr);
            return url.host.toLowerCase().indexOf('f1tv') !== -1 &&
                ['detail'].find(item => url.pathname.toLowerCase().indexOf(item) !== -1);
        }
        return false;
    }
    catch (e) { return false; }
}

const isRace = (content) => content.metadata.additionalStreams !== undefined;

const raceSeriesTypes = [
    'PRACTICE',
    'QUALIFYING',
    'RACE',
    'FULL SESSION',
    'FULL RACE',
    'Sprint Qualifying',
    'Sprint Race'
];

const isRaceSeries = (content) => content.metadata.genres.find(genre => raceSeriesTypes.find(type => type == genre) !== undefined) !== undefined;

const validKey = (key) => (key.match(/^(0[xX]){0,1}[A-Fa-f0-9]{32}:[A-Fa-f0-9]{32}$/) !==  null) ? true : 'The key entered is not valid.';

module.exports = {
    isUrl,
    isRace,
    isRaceSeries,
    isF1tvUrl,
    validKey
};