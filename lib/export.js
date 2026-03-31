// Export to Excel using SheetJS
export async function exportExcel(devices, t) {
  const XLSX = (await import('xlsx')).default;
  const rows = devices.map((d, i) => ({
    '#': i + 1,
    [t.table.name]: d.name,
    [t.table.type]: t.deviceTypes[d.type] || d.type,
    [t.table.status]: t.statuses[d.status] || d.status,
    [t.table.serial]: d.serial,
    [t.table.location]: t.locations[d.location] || d.location,
    [t.table.connection]: d.online ? t.online : t.offline,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
  // column widths
  ws['!cols'] = [{ wch: 4 }, { wch: 22 }, { wch: 16 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 12 }];
  XLSX.writeFile(wb, 'net-expert-inventory.xlsx');
}

// Export to PDF using jsPDF + autotable
export async function exportPDF(devices, t) {
  const { default: jsPDF } = await import('jspdf');
  await import('jspdf-autotable');
  const doc = new jsPDF({ orientation: 'landscape' });

  // Title
  doc.setFontSize(16);
  doc.setTextColor(6, 182, 212);
  doc.text(t.appName, 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(150);
  doc.text(t.appSub, 14, 23);
  doc.text(new Date().toLocaleDateString(), doc.internal.pageSize.width - 14, 16, { align: 'right' });

  const head = [[
    '#',
    t.table.name,
    t.table.type,
    t.table.status,
    t.table.serial,
    t.table.location,
    t.table.connection,
  ]];

  const body = devices.map((d, i) => [
    i + 1,
    d.name,
    t.deviceTypes[d.type] || d.type,
    t.statuses[d.status] || d.status,
    d.serial,
    t.locations[d.location] || d.location,
    d.online ? t.online : t.offline,
  ]);

  doc.autoTable({
    head,
    body,
    startY: 28,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [6, 182, 212], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [240, 249, 255] },
    columnStyles: { 0: { cellWidth: 10 } },
  });

  doc.save('net-expert-inventory.pdf');
}

// Send to Google Sheets Web App
export async function saveToSheets(devices, sheetsUrl) {
  if (!sheetsUrl) throw new Error('No URL');
  const res = await fetch(sheetsUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ devices }),
  });
  if (!res.ok) throw new Error('Sheets error');
  return true;
}
