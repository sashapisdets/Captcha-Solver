import electron from 'electron';
const { app, BrowserWindow, protocol, net } = electron;
import fs from 'fs';
import moment from 'moment';
import express from 'express';
import { readFileSync } from 'original-fs';

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

const captchaBank: ICaptchaData[] = [];

//#region Methods
function sleep(ms:number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

async function initCaptchaWindow() {
	let captchaWindow = new BrowserWindow({
		width: 480,
		height: 680,
			webPreferences: {
				allowRunningInsecureContent: true
			}
	});
	SetupIntercept();

	captchaWindow.loadURL('https://accounts.google.com');
	
	await sleep(1000);

	captchaWindow.webContents.session.webRequest.onBeforeRequest({urls: ['https://myaccount.google.com/*']}, (_details, callback) => {
		callback({redirectURL: 'http://supremenewyork.com/'})
	})
};

function SetupIntercept() {
	protocol.interceptBufferProtocol('http', (req, callback) => {
		if(req.url == 'http://supremenewyork.com/') {
			fs.readFile(__dirname + '/captcha.html', 'utf8', function(_err, html){
				//callback({mimeType: 'text/html', data: Buffer.from(html)});
				callback(Buffer.from(html));
			});
		}else{
			const request = net.request(req)
			request.on('response', res => {
				const chunks: Buffer[] = []
	
				res.on('data', chunk => {
					chunks.push(Buffer.from(chunk))
				})
	
				res.on('end', async () => {
					const file = Buffer.concat(chunks)
					callback(file)
				})
			})
	
			if (req.uploadData) {
				req.uploadData.forEach(part => {
					if (part.bytes) {
						request.write(part.bytes)
					} else if (part.file) {
						request.write(readFileSync(part.file))
					}
				})
			}
	
			request.end()
		}
	})
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

		// Remove the first token in the bank
		captchaBank.splice(0,1);
	});

	return bankExpressApp.listen(bankExpressApp.get('port'));
}

//#endregion Methods

//#region Electron IPC
app.on('ready', () => initCaptchaWindow());

electron.ipcMain.on('openCapWindow', () => initCaptchaWindow());

electron.ipcMain.on('sendCaptcha', function(token: string) {
	captchaBank.push({
	  token: token,	
	  timestamp: moment(),
	  host: 'http://supremenewyork.com/',
	  sitekey: '6LeWwRkUAAAAAOBsau7KpuC9AV-6J8mhw4AjC3Xz'
	})
});
//#endregion Electron IPC




setInterval(function() {
	for (var i = 0; i < captchaBank.length; i++) {
		if (moment().diff(moment(captchaBank[i].timestamp), 'seconds') > 110) {
			console.log('Removing Expired Captcha Token')
			captchaBank.splice(0,1)
		}
	}
}, 1000);
  
const server = initBankServer();
