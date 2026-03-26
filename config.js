require('dotenv').config();
const path = require('path');

module.exports = {
  // รับค่าจาก Environment
  WEBHOOK: process.env.DISCORD_WEBHOOK,
  ZOHO_EMAIL: process.env.ZOHO_EMAIL,
  ZOHO_PASSWORD: process.env.ZOHO_PASSWORD,
  DASHBOARD_URL: "https://desk.zoho.com/agent/carmensoftware/carmen-software-support/dashboards/details/483929000025299144",
  // เปลี่ยน Folder มาไว้ในโปรเจกต์เพื่อให้ GitHub Actions จัดการง่าย
  FOLDER: path.join(__dirname, 'screenshots'),
  REPORTS: [] // ตัดออกเพราะไม่ใช้ส่วนของ Excel ใน GitHub Actions
};