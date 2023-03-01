const config = require('../../lib/config');
const { getF1tvToken } = require('../../lib/f1tv-token');
const { saveF1tvToken, getContentInfo, getContentStreamUrl } = require('../../lib/f1tv-api.js');
const DataStore = require('../../lib/secure-local-data');
const jwtDecode = require('jwt-decode');
const { describe } = require('yargs');


const user = process.env.F1TV_USER;
const pass = process.env.F1TV_PASS;
const raceUrl = process.env.RACEURL;


test('Test for a valid login and savefile', async () => {
    const token = await saveF1tvToken(user, pass);

    // Check valid jwt
    const decoded = jwtDecode(token);
    const exp = new Date(parseInt(decoded.exp * 1000));
    const today = new Date();
    expect(exp.getTime()).toBeGreaterThanOrEqual(today.getTime());

    // Check valid save
    const ds = new DataStore(`${config.HOME}${config.PATH_SEP}${config.DS_FILENAME}`);
    const savedToken = ds.get('token');
    expect(savedToken).toBe(token);

}, 120000);

test('Test for valid tokenized url retrieval', async () => {
    const content = await getContentInfo(raceUrl);
    expect(content).toBeDefined();
    expect(content.id).toBeDefined();

    const f1tvUrl = await getContentStreamUrl(content.id);
    expect(f1tvUrl).toBeDefined();
    expect(f1tvUrl).toMatch(/(m3u8|mpd)/);
});
