const axios = require('axios');
const readline = require('readline');
const dotenv = require('dotenv');
dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.log('❌ Please set ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET in .env file first.');
  process.exit(1);
}

// Zoho accounts URL (change based on your region: .com, .com.au, .eu, .in, .com.cn)
const ACCOUNTS_URL = 'https://accounts.zoho.com';

console.log('--- Zoho Refresh Token Generator ---');
console.log('1. Go to Zoho API Console: https://api-console.zoho.com');
console.log('2. Select your Client (Server-based Application).');
console.log('3. Click "Self-Client" tab.');
console.log('4. Enter Scopes: Desk.tickets.READ, Desk.settings.READ, Desk.bulk.READ');
console.log('5. Set Time Duration: 10 minutes.');
console.log('6. Click "Generate".');
console.log('7. Copy the "Grant Token" (it looks like 1000.xxxx...).');

rl.question('\nEnter the Grant Token: ', async (code) => {
  try {
    const url = `${ACCOUNTS_URL}/oauth/v2/token`;
    const params = new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'authorization_code'
    });

    const response = await axios.post(url, params);
    
    if (response.data.refresh_token) {
      console.log('\n✅ Success!');
      console.log('ZOHO_REFRESH_TOKEN=' + response.data.refresh_token);
      console.log('\nAdd this to your .env file.');
    } else {
      console.log('\n❌ Failed to get refresh token. Response:', response.data);
    }
  } catch (error) {
    console.error('\n❌ Error:', error.response ? error.response.data : error.message);
  } finally {
    rl.close();
  }
});
