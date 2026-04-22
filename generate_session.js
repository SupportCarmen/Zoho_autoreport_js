/**
 * generate_session.js
 * 
 * สคริปต์สำหรับสร้าง session.json ในเครื่อง Local
 * วิธีใช้: node generate_session.js
 * 
 * 1. จะเปิด Browser ให้คุณ Login Zoho ด้วยมือ (รวม OTP)
 * 2. พอ Login เสร็จและเข้า Dashboard ได้แล้ว → ปิด Browser
 * 3. ไฟล์ session.json จะถูกสร้างอัตโนมัติ
 * 4. จากนั้นแปลงเป็น Base64 แล้วใส่ใน GitHub Secret: ZOHO_SESSION_BASE64
 * 
 * คำสั่งแปลง Base64 (PowerShell):
 *   [Convert]::ToBase64String([IO.File]::ReadAllBytes("session.json"))
 */

const { chromium } = require('playwright');
const fs = require('fs');
const { DASHBOARD_URL } = require('./config');

(async () => {
  console.log('🔑 เปิด Browser สำหรับ Login Zoho...');
  console.log('📋 ขั้นตอน:');
  console.log('   1. Login ด้วย Email + Password + OTP');
  console.log('   2. รอจนเข้า Dashboard สำเร็จ');
  console.log('   3. ปิดหน้าต่าง Browser');
  console.log('');

  const browser = await chromium.launch({ headless: false }); // เปิดแบบมีหน้าจอ
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  // ไปหน้า Login
  await page.goto('https://accounts.zoho.com/signin', { timeout: 60000 });

  console.log('⏳ รอคุณ Login... (ปิด Browser เมื่อเสร็จ)');

  // รอจนกว่าจะไปถึง Dashboard URL หรือ user ปิด browser
  try {
    // รอจนกว่า URL จะเปลี่ยนไปที่ desk.zoho.com (login สำเร็จ)
    await page.waitForURL('**/desk.zoho.com/**', { timeout: 300000 }); // รอสูงสุด 5 นาที
    console.log('✅ Login สำเร็จ! กำลังไปที่ Dashboard...');

    // ไปที่ Dashboard เพื่อให้ได้ cookies ครบ
    await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(5000);

    console.log('✅ เข้า Dashboard สำเร็จ!');
  } catch (e) {
    console.log('⚠️ Timeout หรือ Browser ถูกปิด — พยายามบันทึก session ที่มีอยู่...');
  }

  // บันทึก Storage State
  await context.storageState({ path: 'session.json' });
  fs.chmodSync('session.json', 0o600); // Restrict to owner-only
  console.log('💾 บันทึก session.json สำเร็จ!');
  console.log('');
  console.log('📋 ขั้นตอนถัดไป:');
  console.log('   1. เปิด PowerShell แล้วรัน:');
  console.log('      [Convert]::ToBase64String([IO.File]::ReadAllBytes("session.json"))');
  console.log('   2. ก๊อป Base64 string ไปใส่ GitHub Secret ชื่อ: ZOHO_SESSION_BASE64');
  console.log('');

  await browser.close();
})();
