const config = require('./config');
const axiosLib = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const tough = require('tough-cookie');
const DataStore = require('./secure-local-data');
const ds = new DataStore(`${config.HOME}${config.PATH_SEP}${config.DS_FILENAME}`);

let cookieJar;
try {
    cookieJar = tough.CookieJar.fromJSON(JSON.parse(ds.get('cookies')));
} 
catch (e) {
    cookieJar = new tough.CookieJar();
}

module.exports = wrapper(axiosLib.create({
    withCredentials: true,
    maxContentLength: -1,
    jar: cookieJar,
    headers: {
        //"User-Agent": "AppleTV6,2/11.1",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:100.0) Gecko/20100101 Firefox/100.0",
        "Accept": "*/*",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        //"Host": "ott-video-cf.formula1.com",
        "Accept-Language": "en-US,en;q=0.5",
        //"Origin": "https://f1tv.formula1.com",
        "DNT": "1",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-site",
    }
}));

