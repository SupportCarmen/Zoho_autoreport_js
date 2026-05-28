const axios = require('axios');
const fs = require('fs');

/**
 * Get Access Token using Refresh Token
 */
async function getAccessToken(config) {
  const { clientId, clientSecret, refreshToken } = config;
  const url = 'https://accounts.zoho.com/oauth/v2/token';
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });

  try {
    const response = await axios.post(url, params);
    if (response.data.access_token) {
      return response.data.access_token;
    } else {
      throw new Error('Failed to get access token: ' + JSON.stringify(response.data));
    }
  } catch (error) {
    console.error('❌ Error getting access token:', error.response ? error.response.data : error.message);
    throw error;
  }
}

/**
 * Download a file from Zoho using OAuth token
 */
async function downloadFile(url, accessToken, outputPath) {
  try {
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`
      },
      responseType: 'arraybuffer'
    });
    fs.writeFileSync(outputPath, response.data);
    return true;
  } catch (error) {
    console.error('❌ Error downloading file:', error.response ? error.response.data.toString() : error.message);
    throw error;
  }
}

module.exports = { getAccessToken, downloadFile };
