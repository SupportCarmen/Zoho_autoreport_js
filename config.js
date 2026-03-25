require('dotenv').config();
const path = require('path');
const os = require('os');

const BASE = path.join(os.homedir(), 'Downloads');

module.exports = {
  WEBHOOK: "https://discord.com/api/webhooks/1481488917885882531/rmOpalv6_dE9_dYoUYY1x3DPaShVDvGXuKVzh5IFsrmLlR_4eBUOjj6cIU2XCw5fx4im",
  ZOHO_EMAIL: process.env.ZOHO_EMAIL,
  ZOHO_PASSWORD: process.env.ZOHO_PASSWORD,
  DASHBOARD_URL: "https://desk.zoho.com/agent/carmensoftware/carmen-software-support/dashboards/details/483929000025299144",
  FOLDER: path.join(BASE, 'captureReport'),
  REPORT_FOLDER: path.join(BASE, 'report'),
  REPORTS: [
    {
      url: "https://desk.zoho.com/supportapi/api/v1/reports/483929000037008035/export?orgId=710033074&includeDetails=true&from=0&limit=2000&format=xls",
      name: "OpenAll"
    },
    {
      url: "https://desk.zoho.com/supportapi/api/v1/reports/483929000029190842/export?orgId=710033074&includeDetails=true&from=0&limit=2000&format=xls",
      name: "TicketToday"
    }
  ]
};