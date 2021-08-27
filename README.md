# Captcha-Solver
You can use this solver for all those sites that use Google's reCAPTCHA or hCAPTCHA. All you need is the URL of the site and the key that links the site and CAPTCHA.

This solver removes expired captcha tokens automatically.

*The Google login is required by this application as antispam.*

**Sites that use HTTPS**: If the site you are using uses a secure connection, instead of using the HTTPS protocol, use HTTP, this is because otherwise a loop is generated with the CAPTCHA libraries required by the application.

i.e. Use `http://mysite.com` instead of `https://mysite.com`

## Get the site key
1. Navigate to the requested site
2. Right click and select "View page source"
3. Search for the "data-sitekey" property
4. Copy the alphanumeric key

## Fetch token
To get the created tokens (one is created every time a CAPTCHA is resolved) send a GET request to:
+ 127.0.0.1:8080/latest: Returns the last token generated (and removes it from memory)
+ 127.0.0.1:8080/fetch: Returns all generated tokens (and removes them from memory)

To submit requests you can use an application such as [postman](https://www.postman.com/)

# Instructions
1. First clone or download the folder
2. Install dependencies: `npm install`
3. Build source: `npm run build`
4. Start: `npm start`
