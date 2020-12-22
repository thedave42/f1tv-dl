const config = require('../../lib/config');
const { getF1tvToken } = require('../../lib/f1tv-token');
const jwtDecode = require('jwt-decode')


const user = process.env.F1TV_USER;
const pass = process.env.F1TV_PASS;

test('Test for valid jwt', () => {
    return getF1tvToken(user, pass)
        .then( token => {
            const decoded = jwtDecode(token);
            const exp = new Date(parseInt(decoded.exp * 1000));
            const today = new Date();
            expect(exp.getTime()).toBeGreaterThanOrEqual(today.getTime());
        });
}, 30000);