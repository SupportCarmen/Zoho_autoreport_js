// excel.js
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function cleanData(raw) {
  const header = raw[4];
  const rows = raw.slice(5).filter(row => {
    if (!row || row.length === 0) return false;
    const first = String(row[0] || '');
    if (first.toLowerCase().includes('total records')) return false;
    if (first === '') return false;
    return true;
  });
  return [header, ...rows];
}

async function updateMaster(reportFiles, masterFile) {

  const openAllFile     = reportFiles.find(r => r.name === 'OpenAll');
  const ticketTodayFile = reportFiles.find(r => r.name === 'TicketToday');

  if (!openAllFile || !fs.existsSync(openAllFile.file)) {
    console.log(`⚠️  File not found: OpenAll`); return;
  }
  if (!ticketTodayFile || !fs.existsSync(ticketTodayFile.file)) {
    console.log(`⚠️  File not found: TicketToday`); return;
  }

  console.log(`📂 เปิดไฟล์: OpenAll.xls`);
  const wb1   = XLSX.readFile(openAllFile.file);
  const raw1  = XLSX.utils.sheet_to_json(wb1.Sheets[wb1.SheetNames[0]], { header: 1 });
  const data1 = cleanData(raw1);
  console.log(`✅ OpenAll → ${data1.length - 1} rows`);

  console.log(`📂 เปิดไฟล์: TicketToday.xls`);
  const wb2   = XLSX.readFile(ticketTodayFile.file);
  const raw2  = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]], { header: 1 });
  const data2 = cleanData(raw2);
  console.log(`✅ TicketToday → ${data2.length - 1} rows`);

  const master = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(master, XLSX.utils.aoa_to_sheet(data1), 'OpenAll_Data');
  XLSX.utils.book_append_sheet(master, XLSX.utils.aoa_to_sheet(data2), 'Today_Data');
  XLSX.utils.book_append_sheet(master, XLSX.utils.aoa_to_sheet([['READY']]), 'Open_All');

  XLSX.writeFile(master, masterFile);
  console.log(`✅ Master saved`);

  const absMaster = path.resolve(masterFile).replace(/\//g, '\\');

  const vbScript = `
Dim excel, wb, pc, pt, lastRow
Set excel = CreateObject("Excel.Application")
excel.Visible = True
excel.DisplayAlerts = False

Set wb = excel.Workbooks.Open("${absMaster}")
WScript.Sleep 2000

Dim ws
For Each ws In wb.Sheets
  If ws.Name = "Sheet1" Then
    ws.Delete
  End If
Next
WScript.Sleep 500

Dim wsDst, ws1src, ws2src
Set wsDst  = wb.Sheets("Open_All")
Set ws1src = wb.Sheets("OpenAll_Data")
Set ws2src = wb.Sheets("Today_Data")

wsDst.Cells.Clear
WScript.Sleep 500
wsDst.Activate
WScript.Sleep 500

' ── PT 1: OpenAll / Support Member Assigned ──
WScript.Echo "🔄 PT 1/4: OpenAll - Support Member Assigned..."
Set pc = wb.PivotCaches.Create(1, ws1src.UsedRange)
Set pt = pc.CreatePivotTable(wsDst.Cells(1, 1), "PT_Open_Member")
pt.PivotFields("Support Member Assigned").Orientation = 1
pt.PivotFields("Status (Ticket)").Orientation = 2
pt.AddDataField pt.PivotFields("Ticket Id"), "Count of Ticket Id", -4112
WScript.Sleep 2000
WScript.Echo "✅ PT 1/4 สำเร็จ"

' ── PT 2: OpenAll / Product Category ──
WScript.Echo "🔄 PT 2/4: OpenAll - Product Category..."
lastRow = wsDst.UsedRange.Rows.Count + 3
Set pc = wb.PivotCaches.Create(1, ws1src.UsedRange)
Set pt = pc.CreatePivotTable(wsDst.Cells(lastRow, 1), "PT_Open_Product")
pt.PivotFields("Product Category").Orientation = 1
pt.PivotFields("Status (Ticket)").Orientation = 2
pt.AddDataField pt.PivotFields("Ticket Id"), "Count of Ticket Id", -4112
WScript.Sleep 2000
WScript.Echo "✅ PT 2/4 สำเร็จ"

' ── PT 3: Today / Support Member Assigned ──
WScript.Echo "🔄 PT 3/4: Today - Support Member Assigned..."
lastRow = wsDst.UsedRange.Rows.Count + 3
Set pc = wb.PivotCaches.Create(1, ws2src.UsedRange)
Set pt = pc.CreatePivotTable(wsDst.Cells(lastRow, 1), "PT_Today_Member")
pt.PivotFields("Support Member Assigned").Orientation = 1
pt.PivotFields("Status (Ticket)").Orientation = 2
pt.AddDataField pt.PivotFields("Ticket Id"), "Count of Ticket Id", -4112
WScript.Sleep 2000
WScript.Echo "✅ PT 3/4 สำเร็จ"

' ── PT 4: Today / Product Category ──
WScript.Echo "🔄 PT 4/4: Today - Product Category..."
lastRow = wsDst.UsedRange.Rows.Count + 3
Set pc = wb.PivotCaches.Create(1, ws2src.UsedRange)
Set pt = pc.CreatePivotTable(wsDst.Cells(lastRow, 1), "PT_Today_Product")
pt.PivotFields("Product Category").Orientation = 1
pt.PivotFields("Status (Ticket)").Orientation = 2
pt.AddDataField pt.PivotFields("Ticket Id"), "Count of Ticket Id", -4112
WScript.Sleep 2000
WScript.Echo "✅ PT 4/4 สำเร็จ"

wb.Save
WScript.Sleep 1000
wb.Close
excel.Quit

WScript.Echo "✅ PivotTable created"
`;

  const vbsFile = path.join(path.dirname(masterFile), '_pivot.vbs');
  fs.writeFileSync(vbsFile, vbScript, 'utf8');

  console.log(`🔄 สร้าง PivotTable...`);
  try {
    const result = execSync(`cscript //nologo "${vbsFile}"`, { encoding: 'utf8', timeout: 120000 });
    result.trim().split('\n').forEach(line => console.log(line));
  } catch (e) {
    console.error('❌ error:', e.message);
  } finally {
    if (fs.existsSync(vbsFile)) fs.unlinkSync(vbsFile);
  }

  return masterFile;
}

module.exports = { updateMaster };