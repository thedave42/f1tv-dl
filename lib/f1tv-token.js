const config = require('./config');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

const getRandomInt = (min, max) => {
	return Math.floor(Math.random() * (max - min)) + min;
};

const getF1tvToken = async (user, pass) => {
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

	await page.goto(config.BASE_URL, { timeout: 10000, waitUntil: 'networkidle0' });
	await Promise.all([
		page.$eval('a[title="Sign in"]', el => el.click()),
		page.waitForNavigation({ timeout: 10000, waitUntil: 'networkidle0' })
	]);
	await Promise.all([
		page.$eval('#truste-consent-button', el => el.click()),
		page.waitForSelector('#truste-consent-button', { timeout: 10000, hidden: true })
	]);
	await page.type('input.txtLogin', user);
	await page.waitForTimeout(getRandomInt(1000, 3000));
	await page.type('input.txtPassword', pass);
	await page.waitForTimeout(getRandomInt(1000, 3000));
	await Promise.all([
		page.$eval('button.btn.btn-primary', el => el.click()),
		page.waitForNavigation({ timeout: 10000, waitUntil: 'networkidle0' })
	]);

	const cookies = await page.cookies();
	const loginSession = cookies.find(el => el.name == 'entitlement_token');

	await browser.close();

	return loginSession.value;
}

module.exports = {
	getF1tvToken
}