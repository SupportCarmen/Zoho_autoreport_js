const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const { WEBHOOK } = require('./config');

async function sendToDiscord(files, now) {
  const day = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  const message =
`📊Dashboards_Tickets
🕒${day} ${now}
@everyone`;

  const form = new FormData();
  form.append("content", message);
  files.forEach((file, i) => {
    form.append(`file${i}`, fs.createReadStream(file));
  });

  await axios.post(WEBHOOK, form, { headers: form.getHeaders() });
  console.log("Sent to Discord");
}

module.exports = { sendToDiscord };