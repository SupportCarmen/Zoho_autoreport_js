const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { 
  ZOHO_EMAIL, ZOHO_PASSWORD, 
  ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN,
  DASHBOARD_URL, FOLDER, REPORT_FOLDER, REPORTS 
} = require('./config');
const { sendToDiscord } = require('./discord');
const { updateMaster } = require('./excel');
const { getAccessToken, downloadFile } = require('./lib/zoho_api');

const SESSION_FILE = path.join(__dirname, 'session.json');

function isTodaySession() {
  if (!fs.existsSync(SESSION_FILE)) return false;
  try {
    const { date } = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
    return date === new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
  } catch (e) {
    return false;
  }
}

(async () => {

  [FOLDER, REPORT_FOLDER].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  const masterFolder = path.join(os.homedir(), 'Downloads', 'All');
  if (!fs.existsSync(masterFolder)) fs.mkdirSync(masterFolder, { recursive: true });

  const now = new Date()
    .toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' })
    .replace(' ', '_')
    .replace(/:/g, '-');

  // --- Step 1: Handle Report Downloads via API (if credentials available) ---
  let accessToken = null;
  const useApiForReports = ZOHO_CLIENT_ID && ZOHO_CLIENT_SECRET && ZOHO_REFRESH_TOKEN;
  
  if (useApiForReports) {
    console.log("🔐 กำลังขอ Access Token จาก Zoho API...");
    try {
      accessToken = await getAccessToken({
        clientId: ZOHO_CLIENT_ID,
        clientSecret: ZOHO_CLIENT_SECRET,
        refreshToken: ZOHO_REFRESH_TOKEN
      });
      console.log("✅ ได้รับ Access Token สำเร็จ");
    } catch (e) {
      console.log("⚠️ ไม่สามารถขอ Access Token ได้, จะพยายามใช้ Browser แทน");
    }
  }

  const reports = [];
  const reportEntries = [];

  if (accessToken && REPORTS.length > 0) {
    console.log("\n📥 เริ่ม download reports via API...");
    for (const { url, name } of REPORTS) {
      console.log(`📥 กำลัง download: ${name}...`);
      const file = path.join(REPORT_FOLDER, `${name}_${now}.xls`);
      try {
        await downloadFile(url, accessToken, file);
        reports.push(file);
        reportEntries.push({ file, name });
        console.log(`✅ ${name} downloaded via API`);
      } catch (e) {
        console.log(`❌ ${name} download failed via API: ${e.message}`);
      }
    }
  }

  // --- Step 2: Handle Browser for Screenshots (and fallback reports) ---
  console.log("\n🔐 ตรวจสอบ browser session...");
  const browser = await chromium.launch({ headless: false});
  let context;

  if (isTodaySession()) {
    const { state } = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
    context = await browser.newContext({ storageState: state });
    console.log("✅ Session loaded, skip login");
  } else {
    console.log("🔑 ไม่มี session, กำลัง login...");
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36'
    });
    const loginPage = await context.newPage();

    await loginPage.goto("https://accounts.zoho.com/signin", { timeout: 60000 });
    await loginPage.fill('#login_id', ZOHO_EMAIL);
    await loginPage.click('#nextbtn');
    await loginPage.waitForSelector('#password', { timeout: 60000 });
    await loginPage.fill('#password', ZOHO_PASSWORD);
    await loginPage.click('#nextbtn');
    await loginPage.waitForLoadState('networkidle');
    await loginPage.waitForTimeout(6000);
    console.log("✅ Login success");

    const state = await context.storageState();
    fs.writeFileSync(SESSION_FILE, JSON.stringify({
      date: new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' }),
      state
    }), { mode: 0o600 });
    console.log("✅ Session saved");
    await loginPage.close();
  }

  console.log("\n📊 เปิด Dashboard...");
  const page = await context.newPage();
  await page.goto(DASHBOARD_URL, { timeout: 60000 });
  await page.waitForTimeout(6000);
  console.log("✅ Dashboard โหลดสำเร็จ");

  try {
    const btn = page.locator('text=Not Now');
    if (await btn.count() > 0) await btn.click();
  } catch (e) {}

  console.log("\n📸 เริ่ม capture dashboard...");
  const selector = '.zd_v2-dashboarddetailcontainer-container';
  const images = [];
  const scrollSteps = [0, 300, 400, 1200];

  for (let i = 0; i < 4; i++) {
    if (scrollSteps[i] > 0) {
      await page.mouse.wheel(0, scrollSteps[i]);
      await page.waitForTimeout(2000);
    }
    const file = path.join(FOLDER, `${now}_dashboard_${i + 1}.png`);
    await page.locator(selector).screenshot({ path: file });
    images.push(file);
    console.log(`✅ capture ${i + 1}/4`);
  }

  // --- Fallback: Download reports via browser if API failed or not used ---
  if (reportEntries.length === 0 && REPORTS.length > 0) {
    console.log("\n📥 เริ่ม download reports via Browser...");
    for (const { url, name } of REPORTS) {
      console.log(`📥 กำลัง download: ${name}...`);
      try {
        const response = await page.request.get(url);
        const buffer = await response.body();
        const file = path.join(REPORT_FOLDER, `${name}_${now}.xls`);
        fs.writeFileSync(file, buffer);
        reports.push(file);
        reportEntries.push({ file, name });
        console.log(`✅ ${name} downloaded via Browser`);
      } catch (e) {
        console.log(`❌ ${name} download failed via Browser: ${e.message}`);
      }
    }
  }

  await browser.close();
  console.log("\n✅ Browser closed");

  if (reportEntries.length > 0) {
    console.log("\n📊 สร้าง Master Excel...");
    const masterFile = path.join(masterFolder, `Tickets_AllZoho_${now}.xlsx`);
    await updateMaster(reportEntries, masterFile);
  } else {
    console.log("\n⚠️ ข้ามขั้นตอนสร้าง Excel เนื่องจากไม่มีไฟล์ report");
  }

  console.log("\n📤 ส่งไฟล์ไป Discord...");
  await sendToDiscord(images, now);
  console.log("✅ ส่ง Discord สำเร็จ");

  console.log("\n🎉 เสร็จสิ้นทุกขั้นตอน");

})();
