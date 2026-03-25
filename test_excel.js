// test_excel.js
const { updateMaster } = require('./excel');
const fs = require('fs');
const path = require('path');

const REPORT_FOLDER = 'C:/Users/Administrator/Downloads/report';
const MASTER_FOLDER = 'C:/Users/Administrator/Downloads/All';

// หยิบไฟล์ล่าสุดของแต่ละ report
function getLatestFile(folder, prefix) {
  const files = fs.readdirSync(folder)
    .filter(f => f.startsWith(prefix) && f.endsWith('.xls'))
    .sort()
    .reverse();
  if (files.length === 0) throw new Error(`ไม่พบไฟล์ ${prefix} ใน ${folder}`);
  return path.join(folder, files[0]);
}

const reportFiles = [
  { file: getLatestFile(REPORT_FOLDER, 'OpenAll'),     name: 'OpenAll' },
  { file: getLatestFile(REPORT_FOLDER, 'TicketToday'), name: 'TicketToday' }
];

console.log(`📂 OpenAll:     ${reportFiles[0].file}`);
console.log(`📂 TicketToday: ${reportFiles[1].file}`);

const now = new Date()
  .toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' })
  .replace(' ', '_').replace(/:/g, '-');

const masterFile = `${MASTER_FOLDER}/Tickets_AllZoho_${now}.xlsx`;

updateMaster(reportFiles, masterFile)
  .then(() => console.log('✅ Test done'))
  .catch(e => console.error('❌ Error:', e.message));