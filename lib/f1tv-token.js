const config = require('./config');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

const getRandomInt = (min, max) => {
	return Math.floor(Math.random() * (max - min)) + min;
};

const getF1tvToken = async (user, pass, debug=false) => {
	const browser = await puppeteer.launch({
		headless: config.HEADLESS,
		args: [
			'--disable-web-security',
			'--window-size=1400,900',
			'--no-sandbox'
		],
		defaultViewport: {
			width: 1400,
			height: 900
		}
	});
	const page = await browser.newPage();

	await page.goto(config.BASE_URL, { timeout: config.TOKEN_NETWORK_TIMEOUT, waitUntil: 'networkidle0' });
	if (debug) await getScreenshot(page, '01');
	await Promise.all([
		page.$eval('a[title="Sign in"]', el => el.click()),
		getScreenshot(page, '01_sign-in'),
		page.waitForNavigation({ timeout: config.TOKEN_NETWORK_TIMEOUT, waitUntil: 'networkidle0' }),
		getScreenshot(page, '01_sign-in-waitfornav')
	]);
	if (debug) await getScreenshot(page, '02');
	await Promise.all([
		page.$eval('#truste-consent-button', el => el.click()),
		page.waitForSelector('#truste-consent-button', { timeout: 10000, hidden: true })
	]);
	if (debug) await getScreenshot(page, '03');
	await page.type('input.txtLogin', user);
	if (debug) await getScreenshot(page, '04');
	await page.waitForTimeout(getRandomInt(1000, 3000));
	if (debug) await getScreenshot(page, '05');
	await page.type('input.txtPassword', pass);
	if (debug) await getScreenshot(page, '06');
	await page.waitForTimeout(getRandomInt(1000, 3000));
	if (debug) await getScreenshot(page, '07');
	await Promise.all([
		page.$eval('button.btn.btn-primary', el => el.click()),
		page.waitForNavigation({ timeout: config.TOKEN_NETWORK_TIMEOUT, waitUntil: 'networkidle0' })
	]);

	const cookies = await page.cookies();
	const loginSession = cookies.find(el => el.name == 'entitlement_token');

	if (debug) await getScreenshot(page, '08');
	
	await browser.close();

	return loginSession.value;
}

const getScreenshot = async (page, section='default') => {
	return page.screenshot({
		path: `chromium_page_${section}.png`
	});
};

module.exports = {
	getF1tvToken
}