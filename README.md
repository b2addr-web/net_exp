# خبير الشبكة | Net Expert
## نظام إدارة الجرد التقني — Technical Inventory Management System

---

## 🚀 النشر على Vercel (Deploy to Vercel)

### الخطوات:

1. **تثبيت Node.js** من https://nodejs.org (v18 أو أحدث)

2. **تثبيت المكتبات:**
```bash
cd net-expert
npm install
```

3. **تجربة محلية:**
```bash
npm run dev
# افتح http://localhost:3000
```

4. **الرفع على GitHub:**
```bash
git init
git add .
git commit -m "init: net-expert inventory system"
git remote add origin https://github.com/YOUR_USERNAME/net-expert.git
git push -u origin main
```

5. **النشر على Vercel:**
   - اذهب إلى https://vercel.com
   - اختر "New Project" ← Import من GitHub
   - اختر المستودع `net-expert`
   - اضغط Deploy ✅
   - ستحصل على رابط مثل: `https://net-expert.vercel.app`

---

## 🔐 بيانات الدخول الافتراضية

| المستخدم | كلمة المرور | الصلاحية |
|----------|------------|---------|
| admin    | admin123   | مسؤول (Admin) |
| viewer1  | view123    | مشاهد (Viewer) |

---

## 📊 إعداد Google Sheets API

### الخطوة 1: إنشاء Google Sheet
- افتح https://sheets.google.com
- أنشئ جدولاً جديداً باسم `Net Expert Inventory`

### الخطوة 2: فتح Apps Script
- من القائمة: Extensions → Apps Script

### الخطوة 3: الصق هذا الكود في المحرر:

```javascript
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var devices = data.devices;
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Clear existing data
    sheet.clearContents();
    
    // Headers
    var headers = ['#', 'اسم الجهاز', 'النوع', 'الحالة', 'الرقم التسلسلي', 'الموقع', 'الاتصال', 'تاريخ التحديث'];
    sheet.appendRow(headers);
    
    // Style headers
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#0891b2');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    
    // Data rows
    var typeNames = { router:'راوتر', switch:'سويتش', ap:'نقطة وصول', firewall:'جدار حماية', server:'خادم', nas:'تخزين NAS', ups:'UPS', rack:'كبينة شبكة', phone:'هاتف IP', computer:'كمبيوتر', accessory:'ملحق' };
    var statusNames = { new:'جديد', used:'مستخدم', damaged:'تالف' };
    var locationNames = { warehouse:'المستودع', main:'المبنى الرئيسي', factory:'المصنع' };
    
    devices.forEach(function(d, i) {
      sheet.appendRow([
        i + 1,
        d.name,
        typeNames[d.type] || d.type,
        statusNames[d.status] || d.status,
        d.serial,
        locationNames[d.location] || d.location,
        d.online ? 'متصل ✓' : 'غير متصل ✗',
        new Date().toLocaleDateString('ar-SA')
      ]);
    });
    
    // Auto-resize columns
    sheet.autoResizeColumns(1, headers.length);
    
    return ContentService.createTextOutput(JSON.stringify({ success: true, count: devices.length }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput('Net Expert API is running ✓');
}
```

### الخطوة 4: نشر السكريبت
1. اضغط **Deploy** → **New Deployment**
2. النوع: **Web App**
3. Execute as: **Me**
4. Who has access: **Anyone**
5. اضغط **Deploy**
6. انسخ الرابط الظاهر (يبدأ بـ `https://script.google.com/macros/s/...`)

### الخطوة 5: إعداد الرابط في النظام
1. افتح النظام وسجل الدخول كـ Admin
2. اضغط أيقونة الإعدادات ⚙️ في الشريط العلوي
3. الصق الرابط في حقل `Google Sheets API URL`
4. اضغط حفظ
5. اضغط **حفظ في Sheets** من صفحة الجرد

---

## 📁 هيكل المشروع

```
net-expert/
├── pages/
│   ├── _app.js          # App wrapper
│   └── index.js         # Main dashboard
├── components/
│   ├── AuthContext.js    # Auth state management
│   ├── LoginPage.js      # Login screen
│   ├── DeviceModal.js    # Add/Edit device modal
│   ├── UsersPanel.js     # User management
│   └── SettingsPanel.js  # Settings (Google Sheets)
├── lib/
│   ├── data.js           # Constants, translations, sample data
│   └── export.js         # Excel/PDF/Sheets export
├── styles/
│   └── globals.css       # Global styles + animations
├── package.json
├── tailwind.config.js
├── next.config.js
└── README.md
```

---

## ✅ الميزات المتاحة

- 🔐 نظام تسجيل دخول (Admin / Viewer)
- 👥 إدارة المستخدمين (إضافة / حذف)
- 📦 جرد 11 نوع من الأجهزة
- 🏢 3 مواقع (مستودع / مبنى رئيسي / مصنع)
- 🔍 بحث وفلترة متعدد المعايير
- 📊 تصدير Excel + PDF
- ☁️ حفظ في Google Sheets
- 🌙 الوضع الليلي فقط (optimized)
- 🌐 ثنائي اللغة (عربي / English) مع دعم RTL
- 💾 حفظ البيانات محلياً (localStorage)
