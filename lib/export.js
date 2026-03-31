// Export to Excel using SheetJS (browser-compatible)
export async function exportExcel(devices, t) {
  // Load SheetJS from CDN to avoid import issues
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
  const XLSX = window.XLSX;

  // Build rows array
  const headers = [
    '#',
    t.table.name,
    t.table.type,
    t.table.status,
    t.table.serial,
    t.table.location,
    t.table.connection,
  ];

  const rows = devices.map((d, i) => [
    i + 1,
    d.name,
    t.deviceTypes[d.type] || d.type,
    t.statuses[d.status] || d.status,
    d.serial,
    t.locations[d.location] || d.location,
    d.online ? t.online : t.offline,
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Column widths
  ws['!cols'] = [
    { wch: 4 }, { wch: 24 }, { wch: 16 }, { wch: 12 },
    { wch: 20 }, { wch: 18 }, { wch: 12 },
  ];

  // Style header row (background + bold) - SheetJS CE supports basic styles via !ref
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, t.inventory || 'Inventory');
  XLSX.writeFile(wb, 'net-expert-inventory.xlsx');
}

// Export to PDF via HTML print window (fully supports Arabic RTL)
export function exportPDF(devices, t) {
  const isAr = t.dir === 'rtl';
  const date = new Date().toLocaleDateString(isAr ? 'ar-SA' : 'en-US');

  const statusColor = { new: '#10b981', used: '#3b82f6', damaged: '#ef4444' };
  const onlineColor = (o) => o ? '#10b981' : '#94a3b8';

  const rows = devices.map((d, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${d.name}</strong></td>
      <td>${t.deviceTypes[d.type] || d.type}</td>
      <td><span style="color:${statusColor[d.status]};font-weight:600">${t.statuses[d.status] || d.status}</span></td>
      <td style="font-family:monospace;font-size:11px">${d.serial}</td>
      <td>${t.locations[d.location] || d.location}</td>
      <td><span style="color:${onlineColor(d.online)};font-weight:600">${d.online ? t.online : t.offline}</span></td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html dir="${t.dir}" lang="${isAr ? 'ar' : 'en'}">
<head>
  <meta charset="UTF-8"/>
  <title>${t.appName}</title>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'IBM Plex Sans Arabic', Arial, sans-serif;
      direction: ${t.dir};
      padding: 24px;
      color: #1e293b;
      font-size: 13px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 2px solid #0891b2;
    }
    .title { font-size: 22px; font-weight: 700; color: #0891b2; }
    .subtitle { font-size: 12px; color: #64748b; margin-top: 4px; }
    .meta { text-align: ${isAr ? 'left' : 'right'}; font-size: 11px; color: #94a3b8; }
    .count { font-size: 12px; color: #475569; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #0891b2; color: white; }
    thead th {
      padding: 10px 12px;
      font-weight: 600;
      font-size: 12px;
      text-align: ${isAr ? 'right' : 'left'};
    }
    tbody tr:nth-child(even) { background: #f0f9ff; }
    tbody tr:hover { background: #e0f2fe; }
    tbody td { padding: 9px 12px; border-bottom: 1px solid #e2e8f0; }
    .footer {
      margin-top: 20px;
      text-align: center;
      font-size: 10px;
      color: #94a3b8;
    }
    @media print {
      body { padding: 10px; }
      @page { margin: 1cm; size: A4 landscape; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">⚡ ${t.appName}</div>
      <div class="subtitle">${t.appSub}</div>
    </div>
    <div class="meta">
      <div>${date}</div>
      <div style="margin-top:4px">${t.total}: <strong>${devices.length}</strong></div>
    </div>
  </div>
  <div class="count">${isAr ? 'إجمالي النتائج' : 'Total results'}: <strong>${devices.length}</strong></div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>${t.table.name}</th>
        <th>${t.table.type}</th>
        <th>${t.table.status}</th>
        <th>${t.table.serial}</th>
        <th>${t.table.location}</th>
        <th>${t.table.connection}</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">${t.appName} — ${t.appSub} — ${date}</div>
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 800);
    };
  </script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=1100,height=700');
  if (!win) { alert(isAr ? 'يرجى السماح بالنوافذ المنبثقة' : 'Please allow popups'); return; }
  win.document.write(html);
  win.document.close();
}

// Helper: load external script once
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
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
