const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { ZOHO_EMAIL, ZOHO_PASSWORD, DASHBOARD_URL, FOLDER, REPORT_FOLDER, REPORTS } = require('./config');
const { sendToDiscord } = require('./discord');
const { updateMaster } = require('./excel');

const SESSION_FILE = path.join(__dirname, 'session.json');

function isTodaySession() {
  if (!fs.existsSync(SESSION_FILE)) return false;
  const { date } = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
  return date === new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
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

  console.log("🔐 ตรวจสอบ session...");
  const browser = await chromium.launch({ headless: false });
  let context;

  if (isTodaySession()) {
    const { state } = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
    context = await browser.newContext({ storageState: state });
    console.log("✅ Session loaded, skip login");
  } else {
    console.log("🔑 ไม่มี session, กำลัง login...");
    context = await browser.newContext();
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
    }));
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

  console.log("\n📥 เริ่ม download reports...");
  const reports = [];
  const reportEntries = [];

  for (const { url, name } of REPORTS) {
    console.log(`📥 กำลัง download: ${name}...`);
    const response = await page.request.get(url);
    const buffer = await response.body();
    const file = path.join(REPORT_FOLDER, `${name}_${now}.xls`);
    fs.writeFileSync(file, buffer);
    reports.push(file);
    reportEntries.push({ file, name });
    console.log(`✅ ${name} downloaded`);
  }

  await browser.close();
  console.log("\n✅ Browser closed");

  console.log("\n📊 สร้าง Master Excel...");
  const masterFile = path.join(masterFolder, `Tickets_AllZoho_${now}.xlsx`);
  await updateMaster(reportEntries, masterFile);

  console.log("\n📤 ส่งไฟล์ไป Discord...");
  await sendToDiscord([...images, masterFile], now);
  console.log("✅ ส่ง Discord สำเร็จ");

  console.log("\n🎉 เสร็จสิ้นทุกขั้นตอน");

})();