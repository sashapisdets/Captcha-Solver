import electron from 'electron';
const { app, BrowserWindow, protocol, net } = electron;
import { promises as fs } from 'fs';
import moment from 'moment';
import express from 'express';
import path from 'path';

interface ICaptchaData {
	/**
	 * Token returned by the reCAPTCHA after user interaction.
	 */
	token: string;
	/**
	 * Date of interaction between the user and the reCAPTCHA widget.
	 */
	timestamp: moment.Moment;
	/**
	 * URL of the host that is using the reCAPTCHA.
	 */
	host: string;
	/**
	 * Unique site key used by the reCAPTCHA widget.
	 */
	sitekey: string;
}

// Global consts
const EXPIRE_TOKEN_VALUE = 120;
const TARGET_WEBSITE = 'http://supremenewyork.com/';
const TARGET_WEBSITE_KEY = '6LeWwRkUAAAAAOBsau7KpuC9AV-6J8mhw4AjC3Xz';

// Global variables
let captchaBank: ICaptchaData[] = [];

// Set a timer for expired token removal
setInterval(removeExpiredTokens, 1000);

// Start the Express server
const server = initBankServer();

//#region Methods
/**
 * Sleep for `ms` milliseconds.
 * @param ms Number of milliseconds to wait
 */
function sleep(ms:number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Remove from the bank expired tokens.
 */
function removeExpiredTokens() {
	// Save the current length of the array
	const startLenght = captchaBank.length;
	
	captchaBank = captchaBank.filter((captcha) => {
		const timestamp = moment().diff(moment(captcha.timestamp), 'seconds');
		const isExpired = timestamp > EXPIRE_TOKEN_VALUE;
		return !isExpired;
	});

	// Show message only if a token was removed
	const diff = startLenght - captchaBank.length;
	if (diff !== 0) console.log(`Removing ${diff} Expired Captcha Token`);
}

async function initCaptchaWindow() {
	let captchaWindow = new BrowserWindow({
		width: 480,
		height: 680,
			webPreferences: {
				nodeIntegration: false, // is default value after Electron v5
				contextIsolation: true, // protect against prototype pollution
				enableRemoteModule: false, // turn off remote
				preload: path.join(__dirname, "preload.js") // use a preload script
			}
	});

	// Start intercepting incoming requests
	setupIntercept();

	// Log in to Google account to prevent sapm on the target site (?)
	captchaWindow.loadURL('https://accounts.google.com');
	
	await sleep(1000);

	// When we are logged, redirect to target site
	captchaWindow.webContents.session.webRequest.onBeforeRequest(
		{urls: ['https://myaccount.google.com/*']}, 
		(_details, callback) => callback({redirectURL: TARGET_WEBSITE}));
};

function setupIntercept() {
	/**
	 * Write data in a request.
	 */
	async function writeUploadData(data: electron.UploadData[], request: electron.ClientRequest) {
		// Obtains the data from the request
		const promises = data
		.filter((part) => part.bytes || part.file)
		.map(async (part) => part.bytes ?? await fs.readFile(part.file as string));
		
		// Await for all the buffers to be read
		const parts = await Promise.all(promises);

		// Write buffers to request
		parts.forEach((part) => request.write(part));
	}
	async function handler(req: electron.ProtocolRequest, callback: (buffer: Buffer) => void) {
		if(req.url === TARGET_WEBSITE) {
			// Load captcha
			console.log("Loading CAPTCHA page");
			const filename = path.join(__dirname, 'captcha.html');
			const html = await fs.readFile(filename, 'utf8');
			callback(Buffer.from(html));
		}
		else {
			console.log(`Receiving request from: ${req.url}`);
			const request = net.request(req);

			request.on('response', res => {
				const chunks: Buffer[] = [];

				res.on('data', chunk => chunks.push(Buffer.from(chunk)));
				res.on('end', async () => callback(Buffer.concat(chunks)));
			})

			if (req.uploadData) await writeUploadData(req.uploadData, request);

			request.end();
		}
	}

	protocol.interceptBufferProtocol('http', handler);
};

/**
 * Start a listening Express Server on the requested port.
 * @param port Port listening for requests
 * @returns Running server
 */
function initBankServer(port:number = 8080) {
	// Initialize local Express server
	const bankExpressApp = express();

	console.log(`Initializing bank server...`)
	bankExpressApp.set('port', port.toString());
	bankExpressApp.use(express.json());
	bankExpressApp.use(express.urlencoded({ extended: true }));
	console.log(`Bank server listening on port: ${port}`);

	bankExpressApp.get('/trigger', () => initCaptchaWindow());

	bankExpressApp.get('/fetch', function(_req, res) {
		// Return all the reCAPTCHAs' tokens
		return res.json(captchaBank),

		// Remove all the token from bank
		captchaBank = [];
	});

	bankExpressApp.get('/latest', function(_req, res) {
		// Return the last token
		return res.json(captchaBank.pop());
	});

	return bankExpressApp.listen(bankExpressApp.get('port'));
}

//#endregion Methods

//#region Electron IPC
app.on('ready', () => initCaptchaWindow());

app.on('window-all-closed', () => {
	// Close the server
	server.close();

	// Close the app
  	app.quit();
});

electron.ipcMain.on('openCapWindow', () => initCaptchaWindow());

electron.ipcMain.on('sendCaptcha', function(_: any, token: string) {
	console.log("Adding token...");
	captchaBank.push({
	  token: token,
	  timestamp: moment(),
	  host: TARGET_WEBSITE,
	  sitekey: TARGET_WEBSITE_KEY
	});
});
//#endregion Electron IPC
