const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { ZOHO_EMAIL, ZOHO_PASSWORD, DASHBOARD_URL, FOLDER } = require('./config');
const { sendToDiscord } = require('./discord');

(async () => {
  if (!fs.existsSync(FOLDER)) fs.mkdirSync(FOLDER, { recursive: true });

  const now = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }).replace(' ', '_').replace(/:/g, '-');

  console.log("🚀 Starting Playwright...");
  const browser = await chromium.launch({ headless: true }); // ต้องเป็น true บน GitHub
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  // Login Logic
  console.log("🔑 Logging in...");
  await page.goto("https://accounts.zoho.com/signin");
  await page.fill('#login_id', ZOHO_EMAIL);
  await page.click('#nextbtn');
  await page.fill('#password', ZOHO_PASSWORD);
  await page.click('#nextbtn');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000); // รอ Zoho จัดการ session

  console.log("📊 Opening Dashboard...");
  await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(10000); // รอ Dashboard โหลดกราฟให้เสร็จ

  // Capture
  console.log("📸 Capturing...");
  const images = [];
  const selector = '.zd_v2-dashboarddetailcontainer-container';

  // แคปจอแบบง่าย (1 หรือ 2 รูปตามส่วนสำคัญ)
  const file = path.join(FOLDER, `dashboard_${now}.png`);
  await page.locator(selector).screenshot({ path: file });
  images.push(file);

  console.log("📤 Sending to Discord...");
  await sendToDiscord(images, now);

  await browser.close();
  console.log("🎉 Done!");
})();
