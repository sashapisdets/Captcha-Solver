const electron = require('electron')
const { app, BrowserWindow, protocol, net } = electron;
const fs = require('fs');
const moment = require('moment');
const express = require('express')
const bodyParser = require('body-parser')

var expressApp, bankExpressApp, bankServer;

var captchaBank = [];

app.on('ready', () => {
	initCaptchaWindow();
})

function initCaptchaWindow() {
	captchaWindow = new BrowserWindow({
		width: 480,
		height: 680
	})

	SetupIntercept();

	captchaWindow.loadURL('https://accounts.google.com');

	captchaWindow.webContents.toggleDevTools();
	
	captchaWindow.on('close', function(e){
		captchaWindow = null;
	});

	captchaWindow.webContents.session.webRequest.onBeforeRequest({urls: ['https://myaccount.google.com/*']}, (details, callback) => {
		callback({redirectURL: 'http://checkout.shopify.com/'})
	})
};

function SetupIntercept() {
	protocol.interceptBufferProtocol('http', (req, callback) => {
		if(req.url == 'http://checkout.shopify.com/') {
			fs.readFile(__dirname + '/captcha.html', 'utf8', function(err, html){
				callback({mimeType: 'text/html', data: Buffer.from(html)});
			});
		}else{
			const request = net.request(req)
			request.on('response', res => {
				const chunks = []
	
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

electron.ipcMain.on('openCapWindow', function(event, args) {
    initCaptchaWindow();
});

electron.ipcMain.on('sendCaptcha', function(event, token) {

	captchaBank.push({
	  token: token,	
	  timestamp: moment(),
	  host: 'http://checkout.shopify.com/',
	  sitekey: '6LeoeSkTAAAAAA9rkZs5oS82l69OEYjKRZAiKdaF'
	})
});

setInterval(function(){
	for (var i = 0; i < captchaBank.length; i++) {

  	if (moment().diff(moment(captchaBank[i].timestamp), 'seconds') > 110) {
		console.log('Removing Expired Captcha Token')
		captchaBank.splice(0,1)
		
	  }
	}
}, 1000);

function initBankServer() {
	bankExpressApp = express()

	let port = '8080';

	console.log('Bank server listening on port: ' + port);
	bankExpressApp.set('port', port);
	bankExpressApp.use(bodyParser.json());
	bankExpressApp.use(bodyParser.urlencoded({ extended: true }));

	bankExpressApp.get('/trigger', function(req, res) {
		initCaptchaWindow();
	});

	bankExpressApp.get('/fetch', function(req, res) {
		return res.json(captchaBank),
		captchaBank.splice(0,1);
	});

	bankServer = bankExpressApp.listen(bankExpressApp.get('port'));

	}
  
initBankServer();


