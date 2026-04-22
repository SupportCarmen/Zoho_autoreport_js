const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const {
  ZOHO_EMAIL,
  ZOHO_PASSWORD,
  DASHBOARD_URL,
  FOLDER,
  WEBHOOK,
} = require("./config");
const { sendToDiscord } = require("./discord");

const SESSION_FILE = path.join(__dirname, "session.json");

function loadSessionState() {
  if (!fs.existsSync(SESSION_FILE)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(SESSION_FILE, "utf8"));
    if (data.state) return data.state; // wrapped format from index.js
    return data; // raw format from generate_session.js
  } catch (e) {
    console.log("⚠️ Failed to parse session.json:", e.message);
    return null;
  }
}

(async () => {
  let browser;
  try {
    console.log("🔍 Checking environment variables...");
    console.log(`  ZOHO_EMAIL: ${ZOHO_EMAIL ? "✅ SET" : "❌ MISSING"}`);
    console.log(`  ZOHO_PASSWORD: ${ZOHO_PASSWORD ? "✅ SET" : "❌ MISSING"}`);

    if (!ZOHO_EMAIL || !ZOHO_PASSWORD) {
      throw new Error(
        "❌ ZOHO_EMAIL or ZOHO_PASSWORD is not set! Please check GitHub Secrets.",
      );
    }

    if (!fs.existsSync(FOLDER)) fs.mkdirSync(FOLDER, { recursive: true });

    const now = new Date()
      .toLocaleString("sv-SE", { timeZone: "Asia/Bangkok" })
      .replace(" ", "_")
      .replace(/:/g, "-");

    console.log("🚀 Starting Playwright...");
    browser = await chromium.launch({ headless: false });

    let context;
    let page;
    let isSessionLogin = false;
    const sessionState = loadSessionState();

    if (sessionState) {
      console.log("🔐 Session found, trying session login...");
      context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
        storageState: sessionState,
      });
      page = await context.newPage();

      await page.goto(DASHBOARD_URL, {
        waitUntil: "networkidle",
        timeout: 60000,
      });
      await page.waitForTimeout(6000);

      const currentUrl = page.url();
      console.log("🔍 Debug: current URL =", currentUrl);

      if (!currentUrl.includes("accounts.zoho.com/signin")) {
        console.log("✅ Session login success, skip password");
        isSessionLogin = true;
      } else {
        console.log(
          "⚠️ Session expired or invalid, falling back to password login...",
        );
        await page.close();
        await context.close();
      }
    }

    if (!isSessionLogin) {
      console.log("🔑 Logging in with password...");
      context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
      });
      page = await context.newPage();

      await page.goto("https://accounts.zoho.com/signin", { timeout: 60000 });
      await page.waitForTimeout(3000);

      console.log("📧 Entering email...");
      await page.fill("#login_id", ZOHO_EMAIL);
      await page.click("#nextbtn");
      await page.waitForTimeout(3000);

      console.log("🔐 Entering password...");
      await page.waitForSelector("#password", { timeout: 20000 });
      await page.fill("#password", ZOHO_PASSWORD);
      await page.click("#nextbtn");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(6000);

      const currentUrl = page.url();
      console.log("🔍 Debug: current URL =", currentUrl);

      if (currentUrl.includes("accounts.zoho.com")) {
        const debugOtp = path.join(FOLDER, `debug_otp_challenge_${now}.png`);
        await page.screenshot({ path: debugOtp, fullPage: true });
        console.log("⚠️ Still on login page — OTP/CAPTCHA may be required");
        await sendToDiscord([debugOtp], now);
        throw new Error(
          "Login failed: Zoho asked for OTP or extra verification. Update your ZOHO_SESSION_BASE64 secret.",
        );
      }

      console.log("✅ Password login success");
    }

    const debugLogin = path.join(FOLDER, `debug_after_login_${now}.png`);
    await page.screenshot({ path: debugLogin, fullPage: true });
    console.log("🔍 Debug: saved after-login screenshot");

    if (!isSessionLogin) {
      console.log("📊 Opening Dashboard...");
      await page.goto(DASHBOARD_URL, {
        waitUntil: "networkidle",
        timeout: 60000,
      });
      await page.waitForTimeout(15000);
    } else {
      await page.waitForTimeout(9000);
    }

    const debugDash = path.join(FOLDER, `debug_dashboard_${now}.png`);
    await page.screenshot({ path: debugDash, fullPage: true });
    console.log("🔍 Debug: saved dashboard screenshot");
    console.log("🔍 Debug: current URL =", page.url());

    try {
      const btn = page.locator("text=Not Now");
      if ((await btn.count()) > 0) await btn.click();
    } catch (e) {}

    console.log("\n📸 เริ่ม capture dashboard...");
    const selector = ".zd_v2-dashboarddetailcontainer-container";
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

    console.log("📤 Sending to Discord...");
    await sendToDiscord([debugLogin, debugDash, ...images], now);

    await browser.close();
    console.log("🎉 Done!");
  } catch (error) {
    // Sanitize error output to avoid leaking secrets in logs
    let safeMessage = error.message || String(error);
    if (WEBHOOK)
      safeMessage = safeMessage.replaceAll(WEBHOOK, "[REDACTED_WEBHOOK]");
    if (ZOHO_PASSWORD)
      safeMessage = safeMessage.replaceAll(
        ZOHO_PASSWORD,
        "[REDACTED_PASSWORD]",
      );

    console.error("❌ Fatal Error:", safeMessage);
    if (process.env.NODE_ENV === "development") {
      console.error(error.stack);
    }
    if (browser) await browser.close();
    process.exit(1);
  }
})();
