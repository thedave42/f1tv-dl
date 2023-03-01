const config = require('./config');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
//const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');
//puppeteer.use(AdblockerPlugin({ blockTrackers: true }));
const tough = require('tough-cookie');
const axios = require('./f1tv-axios');


const getRandomInt = (min, max) => {
    return Math.floor(Math.random() * (max - min)) + min;
};

const getF1tvToken = async (user, pass) => {
    ///*
    const debug = !config.HEADLESS;
    const browser = await puppeteer.launch({
        product: 'firefox',
        headless: config.HEADLESS,
        /* Chromium Args
        args: [
            '--disable-web-security',
            '--window-size=1400,900',
            '--no-sandbox'
        ],
        //*/
        ///* Firefox Args
        args: [
            '--profile C:/Users/dave/AppData/Local/Mozilla/Firefox/Profiles'
        ],
        //*/
        defaultViewport: {
            width: 1400,
            height: 900
        }
    });
    const page = await browser.newPage();

    await page.goto(config.BASE_URL, { timeout: config.TOKEN_NETWORK_TIMEOUT, waitUntil: 'networkidle0' });
    /*
    if (debug) await getScreenshot(page, '01');
    await Promise.all([
        page.$eval('a[title="Sign in"]', el => el.click()),
        //getScreenshot(page, '01_sign-in'),
        page.waitForNavigation({ timeout: config.TOKEN_NETWORK_TIMEOUT, waitUntil: 'networkidle0' })
        //getScreenshot(page, '01_sign-in-waitfornav')
    ]);
    if (debug) await getScreenshot(page, '02');
    await Promise.all([
        page.$eval('#truste-consent-button', el => el.click()),
        page.waitForSelector('#truste-consent-button', { timeout: 10000, hidden: true })
    ]);
    if (debug) await getScreenshot(page, '03');
    await page.waitForTimeout(getRandomInt(1000, 3000));
    await page.type('input[name="Login"]', user);
    if (debug) await getScreenshot(page, '04');
    await page.waitForTimeout(getRandomInt(1000, 3000));
    if (debug) await getScreenshot(page, '05');
    await page.type('input[name="Password"]', pass);
    if (debug) await getScreenshot(page, '06');
    await page.waitForTimeout(getRandomInt(1000, 3000));
    if (debug) await getScreenshot(page, '07');
    await Promise.all([
        page.$eval('button.btn.btn-primary', el => el.click()),
        page.waitForNavigation({ timeout: config.TOKEN_NETWORK_TIMEOUT, waitUntil: 'networkidle0' })
    ]);
    //*/
    
    const cookies = await page.cookies();
    const url = await page.url();
    //*/

    // create a cookiejar that supports public domains
    const cookieJar = new tough.CookieJar();
    cookieJar.store.synchronous = true;
    ///*
    const loginSession = cookies.find(el => el.name == 'entitlement_token');
    cookies.forEach(item => {
        const c = {
            key: item.name,
            value: item.value,
            domain: item.domain,
            path: item.path,
            httpOnly: item.httpOnly,
            secure: item.secure,
            sameSite: item.sameSite
        };
        const ck = new tough.Cookie(c);
        cookieJar.setCookie(ck, url, { synchronous: true });
    });
    //*/

    /*
    const url = 'https://api.formula1.com/v2/account/subscriber/authenticate/by-password';

    cookieJar.setCookie(
        new tough.Cookie({
            key: 'user-metadata',
            value: '{"subscriptionSource":"","userRegistrationLevel":"full","subscribedProduct":"F1 TV Pro Annual","subscriptionExpiry":"99/99/9999"}',
            domain: 'api.formula1.com',
            path: '',
            httpOnly: false,
            secure: false,
            sameSite: 'none'
        }), 
        url, 
        {
            synchronous: true
        }
    );

    const reqData = {
        "Login":"dave_pda@digitalnoise.net", 
        "Password": "tfn2fen7yhm9ACJ-cvy", 
        "DistributionChannel": "d861e38f-05ea-4063-8776-a7e2b6d885a4"
    };

    const respData = await axios.post(url, reqData, {jar: cookieJar});
    //*/

    const cookieJson = JSON.stringify(cookieJar.toJSON());

    if (debug) await getScreenshot(page, '08');

    //await browser.close();

    return {
        "token": loginSession.value,
        "cookies": cookieJson
    };
}

const getScreenshot = async (page, section = 'default') => {
    return page.screenshot({
        path: `chromium_page_${section}.png`
    });
};

module.exports = {
    getF1tvToken
}