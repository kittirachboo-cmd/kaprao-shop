/**
 * กะเพราไฟลุก — รับออเดอร์ + สลิปจากเว็บ แล้วเขียนลง Google Sheet + ส่งอีเมลแจ้งร้าน
 *
 * วิธีติดตั้ง (ทำครั้งเดียว):
 * 1. เปิด Google Sheet → เมนู ส่วนขยาย (Extensions) → Apps Script
 * 2. ลบโค้ดเดิม วางไฟล์นี้ทั้งหมด แล้วแก้ SECRET ด้านล่างเป็นรหัสยาว ๆ ของเราเอง
 *    (ต้องตรงกับ GOOGLE_SHEET_SECRET ใน Vercel ทุกตัวอักษร)
 * 3. เลือกฟังก์ชัน setup แล้วกด Run (ครั้งแรกจะขอสิทธิ์ชีต + ส่งอีเมล → อนุญาต)
 *    → แท็บ "ออเดอร์" จะมีหัวตารางครบ และได้อีเมลทดสอบ 1 ฉบับ
 * 4. กด Deploy → New deployment → ประเภท Web app
 *      Execute as: Me
 *      Who has access: Anyone      ← ต้องเป็น Anyone เท่านั้น ไม่งั้นเว็บส่งเข้ามาไม่ได้
 *    → Deploy แล้ว copy "Web app URL" (ลงท้าย /exec)
 * 5. เอา URL ไปใส่ GOOGLE_SHEET_WEBHOOK_URL ใน Vercel → Redeploy เว็บ
 * 6. ทดสอบ: เปิด https://<เว็บร้าน>/api/sheet-test?secret=<SECRET> ต้องขึ้น ok: true
 *
 * แก้โค้ดทีหลัง ต้อง Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy ทุกครั้ง
 * (ถ้ากด New deployment จะได้ URL ใหม่ ต้องไปแก้ใน Vercel ด้วย)
 */

const SECRET = 'เปลี่ยนเป็นรหัสลับของเรา-อย่างน้อย-20-ตัว';
const SHEET_NAME = 'ออเดอร์';

// อีเมลรับแจ้งเตือน: เว้นว่าง = ส่งเข้าอีเมลเจ้าของชีต, ใส่หลายอีเมลคั่นด้วย , ได้, ใส่ 'off' = ไม่ส่ง
const NOTIFY_EMAIL = '';

const HEADERS = [
  'เลขออเดอร์',     // 1
  'วันเวลา',        // 2
  'ชื่อลูกค้า',       // 3
  'เบอร์โทร',       // 4
  'ที่อยู่จัดส่ง',      // 5
  'รายการอาหาร',    // 6
  'จำนวนจาน',      // 7
  'ยอดรวม (บาท)',   // 8
  'หมายเหตุ',       // 9
  'สถานะ',         // 10
  'Order ID',      // 11
  'สลิป',          // 12
  'ผลตรวจสลิป',     // 13
];
const COL = { status: 10, orderId: 11, slip: 12, slipResult: 13 };

const STATUSES = ['รอชำระเงิน', 'รอตรวจสลิป', 'ชำระแล้ว', 'กำลังทำ', 'จัดส่งแล้ว', 'ยกเลิก'];
const STATUS_COLORS = {
  'รอชำระเงิน': '#fde2e1',
  'รอตรวจสลิป': '#fff3c4',
  'ชำระแล้ว': '#d9f0dc',
};

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  // เขียนหัวตารางใหม่ทุกครั้ง → ชีตเก่าที่มี 11 คอลัมน์จะได้คอลัมน์สลิปเพิ่มเอง
  const head = sheet.getRange(1, 1, 1, HEADERS.length);
  if (head.getValues()[0].join('|') !== HEADERS.join('|')) {
    head.setValues([HEADERS])
      .setFontWeight('bold')
      .setBackground('#1f4d2b')
      .setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(5, 260);  // ที่อยู่
    sheet.setColumnWidth(6, 300);  // รายการ
    sheet.setColumnWidth(13, 320); // ผลตรวจสลิป
  }
  return sheet;
}

/** กด Run ฟังก์ชันนี้ 1 ครั้งตอนติดตั้ง (และทุกครั้งที่อัปเดตโค้ดเวอร์ชันใหม่) */
function setup() {
  getSheet_();
  notify_('ทดสอบแจ้งเตือน', 'ถ้าเห็นอีเมลนี้ แปลว่าระบบแจ้งเตือนออเดอร์พร้อมแล้ว');
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.secret !== SECRET) return json_({ ok: false, error: 'unauthorized: SECRET ไม่ตรงกับ GOOGLE_SHEET_SECRET' });

    if (data.action === 'ping') {
      const sheet = getSheet_();
      return json_({ ok: true, sheet: sheet.getName(), rows: sheet.getLastRow() });
    }

    lock.waitLock(10000); // กันออเดอร์ที่เข้าพร้อมกันเขียนทับแถวกัน
    const sheet = getSheet_();
    const row = upsert_(sheet, data);

    if (data.action === 'slip') {
      notify_(
        'สลิปเข้า #' + data.order_no + ' · ' + data.status,
        'ออเดอร์ #' + data.order_no + ' (' + data.customer_name + ') ยอด ' + data.total + ' บาท\n' +
        'ผลตรวจ: ' + data.slip_result + '\n\nดูสลิป: ' + data.slip_url + '\n\nชีต: ' +
        SpreadsheetApp.getActiveSpreadsheet().getUrl() + '#gid=' + sheet.getSheetId() + '&range=A' + row
      );
    } else {
      notify_(
        'ออเดอร์ใหม่ #' + data.order_no + ' · ' + data.total + ' บาท',
        data.customer_name + ' ' + data.phone + '\n' + data.address + '\n\n' + data.items +
        (data.note ? '\n\nหมายเหตุ: ' + data.note : '') + '\n\n(รอลูกค้าโอน + แนบสลิป)'
      );
    }
    return json_({ ok: true, row: row });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

/** หาแถวจาก Order ID → อัปเดต, ถ้าไม่เจอ → เพิ่มแถวใหม่ (เผื่อตอนสั่งเขียนชีตไม่สำเร็จ) */
function upsert_(sheet, d) {
  let row = findRow_(sheet, d.order_id);
  if (!row) {
    sheet.appendRow([
      '#' + d.order_no,
      d.created_at,
      d.customer_name,
      "'" + d.phone,          // ใส่ ' นำหน้า กันเลข 0 หาย
      d.address,
      d.items,
      Number(d.dishes),
      Number(d.total),
      d.note || '',
      d.status || 'รอชำระเงิน',
      d.order_id,
      '',
      '',
    ]);
    row = sheet.getLastRow();
    sheet.getRange(row, COL.status).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).build()
    );
    sheet.getRange(row, 1, 1, HEADERS.length).setVerticalAlignment('top').setWrap(true);
  } else if (d.status) {
    sheet.getRange(row, COL.status).setValue(d.status);
  }

  if (d.slip_url) {
    sheet.getRange(row, COL.slip).setFormula('=HYPERLINK("' + String(d.slip_url).replace(/"/g, '""') + '","ดูสลิป")');
  }
  if (d.slip_result) sheet.getRange(row, COL.slipResult).setValue(d.slip_result);

  const color = STATUS_COLORS[d.status];
  if (color) sheet.getRange(row, COL.status).setBackground(color);
  return row;
}

function findRow_(sheet, orderId) {
  const last = sheet.getLastRow();
  if (last < 2 || !orderId) return 0;
  const hit = sheet.getRange(2, COL.orderId, last - 1, 1)
    .createTextFinder(String(orderId)).matchEntireCell(true).findNext();
  return hit ? hit.getRow() : 0;
}

function notify_(subject, body) {
  if (NOTIFY_EMAIL === 'off') return;
  const to = NOTIFY_EMAIL || Session.getEffectiveUser().getEmail();
  if (!to) return;
  try {
    MailApp.sendEmail(to, '[กะเพราไฟลุก] ' + subject, body);
  } catch (err) {
    console.error('mail: ' + err); // เมลล้มไม่ให้กระทบการเขียนชีต
  }
}

function doGet() {
  return json_({ ok: true, message: 'กะเพราไฟลุก sheet webhook พร้อมใช้งาน' });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
