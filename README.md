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
