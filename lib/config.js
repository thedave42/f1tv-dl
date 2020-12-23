require('dotenv').config();
const path = require('path');


module.exports = {
    HOME: require('os').homedir(),
    PATH_SEP: path.sep,
    API_KEY: 'fCUCjWrKPu9ylJwRAv8BpGLEgiAuThx7',
    BASE_URL: 'https://f1tv.formula1.com',
    LOGIN_URL: 'https://api.formula1.com',
    AUTH_URL: 'https://f1tv-api.formula1.com',
    ACCOUNT_UTL: 'https://account.formula1.com',
    DIST_CHANNEL: 'd861e38f-05ea-4063-8776-a7e2b6d885a4',
    F1TV_IDP: '/api/identity-providers/iden_732298a17f9c458890a1877880d140f3/',
    DS_FILENAME: '.f1tv.json',
    DS_CRYPT_KEY_SEED: 'MercedesRedBullRacingHondaMcLarenRenaultRacingPointBWTMercedesRenaultFerrariAlphaTauriHondaAlfaRomeoRacingFerrariHaasFerrariWilliamsMercedes',
    DS_CRYPT_ALGO: 'aes-192-cbc',
    HEADLESS: true,

    makeItGreen: (str) => {
        return '\x1b[32m' + str + '\x1b[37m';
    }
};

