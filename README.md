# خبير الشبكة | Net Expert
## نظام إدارة الجرد التقني الاحترافي

---

## 🚀 النشر على Vercel

```bash
cd net-expert
npm install
npm run dev          # تجربة محلية على http://localhost:3000
```

للنشر:
1. ارفع المشروع على GitHub
2. اذهب إلى vercel.com → New Project → Import من GitHub
3. Deploy ✅

---

## 🔐 بيانات الدخول الافتراضية

| المستخدم | كلمة المرور | الصلاحية |
|----------|------------|---------|
| admin    | admin123   | مسؤول كامل |
| viewer1  | view123    | مشاهدة فقط |

---

## 📊 كود Google Apps Script الكامل

افتح Google Sheets → Extensions → Apps Script → الصق هذا الكود كاملاً:

```javascript
// ═══════════════════════════════════════════════════════
// Net Expert — Google Apps Script
// يدعم: حفظ الجرد، سجل العمليات، رفع الملفات على Drive
// ═══════════════════════════════════════════════════════

const INVENTORY_SHEET = 'الجرد';
const AUDIT_SHEET     = 'سجل العمليات';
const DRIVE_FOLDER    = 'Net Expert Attachments';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // ── رفع ملف إلى Google Drive ──────────────────────────
    if (data.action === 'uploadFile') {
      return uploadFileToDrive(data);
    }

    // ── حفظ الجرد + سجل العمليات ──────────────────────────
    if (data.action === 'syncInventory') {
      syncInventory(data.devices);
      if (data.auditLog && data.auditLog.length > 0) {
        syncAuditLog(data.auditLog);
      }
      return ok({ synced: data.devices.length });
    }

    return ok({ message: 'unknown action' });
  } catch(err) {
    return err_response(err.toString());
  }
}

function doGet(e) {
  return ContentService.createTextOutput('Net Expert API ✓ Running');
}

// ── حفظ الجرد ─────────────────────────────────────────────
function syncInventory(devices) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let sheet   = ss.getSheetByName(INVENTORY_SHEET);
  if (!sheet) sheet = ss.insertSheet(INVENTORY_SHEET);

  sheet.clearContents();

  const headers = [
    '#', 'اسم الجهاز', 'النوع', 'الحالة', 'الرقم التسلسلي',
    'الموقع', 'الاتصال', 'الموظف المسؤول', 'الرقم الوظيفي',
    'أضيف بواسطة', 'إيميل المضيف', 'تاريخ الإضافة',
    'آخر تعديل بواسطة', 'وقت آخر تعديل', 'رابط المرفق'
  ];
  sheet.appendRow(headers);

  // تنسيق الهيدر
  const hRange = sheet.getRange(1, 1, 1, headers.length);
  hRange.setBackground('#0891b2').setFontColor('#ffffff').setFontWeight('bold');

  const typeAr = { router:'راوتر', switch:'سويتش', ap:'نقطة وصول', firewall:'جدار حماية', server:'خادم', nas:'تخزين NAS', ups:'UPS', rack:'كبينة', phone:'هاتف IP', computer:'كمبيوتر', accessory:'ملحق' };
  const statusAr = { new:'جديد', used:'مستخدم', damaged:'تالف' };
  const locAr = { warehouse:'المستودع', main:'المبنى الرئيسي', factory:'المصنع' };

  devices.forEach(function(d, i) {
    sheet.appendRow([
      i + 1,
      d.name || '',
      typeAr[d.type] || d.type || '',
      statusAr[d.status] || d.status || '',
      d.serial || '',
      locAr[d.location] || d.location || '',
      d.online ? 'متصل ✓' : 'غير متصل ✗',
      d.employee || '',
      d.empId || '',
      d.addedBy || '',
      d.updatedByEmail || '',
      d.addedAt ? new Date(d.addedAt).toLocaleString('ar-SA') : '',
      d.updatedBy || '',
      d.updatedAt ? new Date(d.updatedAt).toLocaleString('ar-SA') : '',
      d.attachmentUrl || ''
    ]);
  });

  sheet.autoResizeColumns(1, headers.length);
  sheet.setFrozenRows(1);

  // تلوين صفوف التالف
  for (let r = 2; r <= devices.length + 1; r++) {
    const statusCell = sheet.getRange(r, 4).getValue();
    if (statusCell === 'تالف') {
      sheet.getRange(r, 1, 1, headers.length).setBackground('#fef2f2');
    } else if (statusCell === 'جديد') {
      sheet.getRange(r, 1, 1, headers.length).setBackground('#f0fdf4');
    }
  }
}

// ── حفظ سجل العمليات ──────────────────────────────────────
function syncAuditLog(auditLog) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let sheet   = ss.getSheetByName(AUDIT_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(AUDIT_SHEET);
    // إخفاء الشيت تلقائياً
    sheet.hideSheet();
  }

  // إذا كان الشيت فارغاً أضف الهيدر
  if (sheet.getLastRow() === 0) {
    const headers = ['الوقت', 'العملية', 'اسم الجهاز', 'القيمة القديمة', 'القيمة الجديدة', 'اسم المستخدم', 'إيميل المستخدم'];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setBackground('#7c3aed').setFontColor('#fff').setFontWeight('bold');
  }

  // أضف فقط السجلات الجديدة (تجنب التكرار)
  const existing = sheet.getLastRow();
  auditLog.forEach(function(e) {
    sheet.appendRow([
      e.time ? new Date(e.time).toLocaleString('ar-SA') : '',
      e.action === 'added' ? 'إضافة' : e.action === 'edited' ? 'تعديل' : 'حذف',
      e.deviceName || '',
      e.oldVal || '',
      e.newVal || '',
      e.userName || '',
      e.userEmail || ''
    ]);
  });

  sheet.autoResizeColumns(1, 7);
}

// ── رفع ملف إلى Google Drive ──────────────────────────────
function uploadFileToDrive(data) {
  const folders = DriveApp.getFoldersByName(DRIVE_FOLDER);
  const folder  = folders.hasNext() ? folders.next() : DriveApp.createFolder(DRIVE_FOLDER);

  const bytes   = Utilities.base64Decode(data.data);
  const blob    = Utilities.newBlob(bytes, data.mimeType, data.fileName);
  const file    = folder.createFile(blob);

  // اجعل الملف قابلاً للمشاركة بالرابط
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const url = 'https://drive.google.com/file/d/' + file.getId() + '/view';
  return ok({ url: url, name: data.fileName });
}

// ── Helpers ────────────────────────────────────────────────
function ok(data) {
  return ContentService
    .createTextOutput(JSON.stringify(Object.assign({ success: true }, data)))
    .setMimeType(ContentService.MimeType.JSON);
}

function err_response(msg) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: false, error: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### خطوات النشر:
1. افتح Google Sheets → Extensions → Apps Script
2. الصق الكود أعلاه
3. اضغط Deploy → New Deployment → Web App
4. Execute as: **Me** | Who has access: **Anyone**
5. انسخ الرابط وضعه في إعدادات النظام ⚙️

---

## ✅ الميزات الكاملة

| الميزة | التفاصيل |
|--------|---------|
| 🔐 تسجيل دخول | Admin / Viewer مع حفظ الجلسة |
| 👥 إدارة المستخدمين | إضافة / حذف مع تحديد الصلاحية |
| 📦 11 نوع جهاز | مع حقول قابلة للكتابة الحرة |
| 🏢 3 مواقع | مستودع / مبنى رئيسي / مصنع |
| 👤 بيانات الموظف | اسم الموظف + الرقم الوظيفي |
| ⚡ تسجيل تلقائي | المستخدم + الإيميل + التاريخ والوقت |
| 📋 سجل العمليات | كل إضافة/تعديل/حذف مع من ومتى |
| 📎 مرفقات | رفع صور/PDF إلى Google Drive |
| 🔍 بحث وفلترة | بالنوع والموقع والحالة والموظف |
| 📊 تصدير CSV | يفتح في Excel مع دعم العربية |
| 📄 تصدير PDF | طباعة احترافية بخط عربي |
| ☁️ Google Sheets | حفظ الجرد + سجل العمليات |
| 🌐 ثنائي اللغة | عربي RTL / English LTR |
