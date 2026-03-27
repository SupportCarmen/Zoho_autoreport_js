const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { ZOHO_EMAIL, ZOHO_PASSWORD, DASHBOARD_URL, FOLDER } = require('./config');
const { sendToDiscord } = require('./discord');

(async () => {
  let browser;
  try {
    if (!fs.existsSync(FOLDER)) fs.mkdirSync(FOLDER, { recursive: true });

    const now = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }).replace(' ', '_').replace(/:/g, '-');

    // ===== เช็คว่ามี session.json หรือไม่ =====
    const sessionPath = path.join(__dirname, 'session.json');
    const hasSession = fs.existsSync(sessionPath);

    if (hasSession) {
      console.log("🔑 พบ session.json — ใช้ Storage State (ข้าม Login)");
    } else {
      console.log("🔑 ไม่พบ session.json — ใช้ Login ด้วย Email/Password");
      console.log(`  ZOHO_EMAIL: ${ZOHO_EMAIL ? '✅ SET' : '❌ MISSING'}`);
      console.log(`  ZOHO_PASSWORD: ${ZOHO_PASSWORD ? '✅ SET' : '❌ MISSING'}`);
      if (!ZOHO_EMAIL || !ZOHO_PASSWORD) {
        throw new Error("❌ ไม่มี session.json และ ZOHO_EMAIL/ZOHO_PASSWORD ก็ไม่ได้ตั้ง! กรุณาสร้าง session.json ก่อน");
      }
    }

    console.log("🚀 Starting Playwright...");
    browser = await chromium.launch({ headless: true });

    // สร้าง context พร้อม storageState ถ้ามี session.json
    const contextOptions = {
      viewport: { width: 1920, height: 1080 }
    };
    if (hasSession) {
      contextOptions.storageState = sessionPath;
    }
    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();

    if (hasSession) {
      // ===== โหมด Session: ไปที่ Dashboard ตรงๆ =====
      console.log("📊 Opening Dashboard directly (using session)...");
      console.log("🔍 Debug: Dashboard URL =", DASHBOARD_URL);
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(5000);

      // ตรวจสอบว่า Session หมดอายุหรือไม่
      const currentUrl = page.url();
      console.log("🔍 Debug: Current URL after navigation =", currentUrl);

      if (currentUrl.includes('accounts.zoho.com')) {
        console.log("❌ Session หมดอายุ! กรุณาสร้าง session.json ใหม่ที่เครื่อง Local");
        console.log("   รัน: node generate_session.js");
        console.log("   แล้วอัพเดต GitHub Secret: ZOHO_SESSION_BASE64");
        console.log("🔍 Debug: Redirected URL =", currentUrl);

        // ถ่ายภาพหน้าจอ debug ส่งไป Discord เพื่อแจ้งเตือน
        const debugExpired = path.join(FOLDER, `debug_session_expired_${now}.png`);
        await page.screenshot({ path: debugExpired, fullPage: true });
        await sendToDiscord([debugExpired], now);

        await browser.close();
        process.exit(1);
      }
    } else {
      // ===== โหมด Login: Login ด้วย Email/Password (fallback) =====
      console.log("🔑 Logging in...");
      await page.goto("https://accounts.zoho.com/signin", { timeout: 60000 });
      await page.fill('#login_id', ZOHO_EMAIL);
      await page.click('#nextbtn');
      await page.waitForSelector('#password', { timeout: 20000 });
      await page.fill('#password', ZOHO_PASSWORD);
      await page.click('#nextbtn');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(6000);

      // Debug: ถ่ายภาพหน้าจอหลัง Login
      const debugLogin = path.join(FOLDER, `debug_after_login_${now}.png`);
      await page.screenshot({ path: debugLogin, fullPage: true });
      console.log("🔍 Debug: saved after-login screenshot");
      console.log("🔍 Debug: current URL =", page.url());

      console.log("📊 Opening Dashboard...");
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle', timeout: 60000 });
    }

    // ===== รอ Dashboard โหลดเสร็จ =====
    await page.waitForTimeout(15000);

    // Debug: ถ่ายภาพหน้าจอ Dashboard
    const debugDash = path.join(FOLDER, `debug_dashboard_${now}.png`);
    await page.screenshot({ path: debugDash, fullPage: true });
    console.log("🔍 Debug: saved dashboard screenshot");
    console.log("🔍 Debug: current URL =", page.url());

    // ===== Capture =====
    console.log("📸 Capturing...");
    const images = [];
    const selector = '.zd_v2-dashboarddetailcontainer-container';

    const found = await page.locator(selector).count();
    console.log(`🔍 Debug: selector '${selector}' found = ${found}`);

    if (found > 0) {
      const file = path.join(FOLDER, `dashboard_${now}.png`);
      await page.locator(selector).screenshot({ path: file });
      images.push(file);
    } else {
      console.log("⚠️ Selector not found, using full page screenshot...");
      const file = path.join(FOLDER, `dashboard_full_${now}.png`);
      await page.screenshot({ path: file, fullPage: true });
      images.push(file);
    }

    // ===== ส่ง Discord =====
    console.log("📤 Sending to Discord...");
    await sendToDiscord([debugDash, ...images], now);

    await browser.close();
    console.log("🎉 Done!");
  } catch (error) {
    console.error("❌ Fatal Error:", error.message);
    console.error(error.stack);
    if (browser) await browser.close();
    process.exit(1);
  }
})();
