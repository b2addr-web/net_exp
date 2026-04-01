const SAR = (n) => `${(n || 0).toLocaleString('ar-SA')} ريال`;

export function exportExcelFinance(records, type, t) {
  const typeLabel = t.fin[type] || type;
  const headers = [
    '#',
    t.fin.description,
    t.fin.date,
    t.fin.amount,
    t.fin.vendor,
    t.fin.category,
    t.fin.invoiceNo,
    t.fin.invoice,
  ];
  const rows = records.map((r, i) => [
    i + 1,
    r.description || '',
    r.date || '',
    r.amount || 0,
    r.vendor || '',
    r.category || '',
    r.invoiceNo || '',
    r.attachmentName || '',
  ]);

  const escape = v => {
    const s = String(v ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const total = records.reduce((s, r) => s + (r.amount || 0), 0);
  const csv = [
    headers,
    ...rows,
    [],
    [t.total, '', '', total],
  ].map(row => row.map(escape).join(',')).join('\r\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `net-expert-${type}-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportPDFFinance(records, type, t) {
  const isAr = t.dir === 'rtl';
  const typeLabel = t.fin[type] || type;
  const date = new Date().toLocaleDateString(isAr ? 'ar-SA' : 'en-US');
  const total = records.reduce((s, r) => s + (r.amount || 0), 0);

  const rows = records.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${r.description || '—'}</strong></td>
      <td>${r.date || '—'}</td>
      <td style="color:#10b981;font-weight:600;font-family:monospace">${(r.amount || 0).toLocaleString()} ${t.fin.sar}</td>
      <td>${r.vendor || '—'}</td>
      <td><span style="background:#e0f2fe;color:#0369a1;padding:2px 8px;border-radius:6px;font-size:10px">${r.category || '—'}</span></td>
      <td style="font-family:monospace;font-size:10px">${r.invoiceNo || '—'}</td>
      <td>${r.attachmentUrl ? `<a href="${r.attachmentUrl}" style="color:#06b6d4" target="_blank">📎</a>` : '—'}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html dir="${t.dir}" lang="${isAr ? 'ar' : 'en'}">
<head>
  <meta charset="UTF-8"/>
  <title>${t.appName} — ${typeLabel}</title>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'IBM Plex Sans Arabic','Segoe UI',Arial,sans-serif;direction:${t.dir};padding:24px 28px;color:#1e293b;font-size:12px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;padding-bottom:12px;border-bottom:3px solid #10b981}
    .title{font-size:18px;font-weight:700;color:#10b981}
    .subtitle{font-size:10px;color:#64748b;margin-top:2px}
    .meta{text-align:${isAr?'left':'right'};font-size:11px;color:#475569}
    .summary{display:flex;gap:12px;margin-bottom:14px}
    .sum-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 14px;font-size:11px}
    .sum-box strong{color:#10b981;font-size:14px;display:block}
    table{width:100%;border-collapse:collapse}
    thead tr{background:#10b981;color:#fff}
    thead th{padding:9px 11px;font-weight:600;font-size:10px;text-align:${isAr?'right':'left'}}
    tbody tr{border-bottom:1px solid #f1f5f9}
    tbody tr:nth-child(even){background:#f8fafc}
    tbody td{padding:8px 11px;vertical-align:middle}
    .footer{margin-top:16px;padding-top:10px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8}
    .total-row{background:#f0fdf4;font-weight:700}
    @media print{body{padding:8px 12px}@page{margin:0.6cm;size:A4 landscape}}
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">⚡ ${t.appName} — ${typeLabel}</div>
      <div class="subtitle">${t.appSub}</div>
    </div>
    <div class="meta"><div>${date}</div><div>${isAr?'عدد السجلات':'Records'}: <strong>${records.length}</strong></div></div>
  </div>
  <div class="summary">
    <div class="sum-box">${isAr?'الإجمالي':'Total'}: <strong>${total.toLocaleString()} ${t.fin.sar}</strong></div>
    <div class="sum-box">${isAr?'عدد السجلات':'Records'}: <strong>${records.length}</strong></div>
  </div>
  <table>
    <thead><tr>
      <th>#</th><th>${t.fin.description}</th><th>${t.fin.date}</th>
      <th>${t.fin.amount}</th><th>${t.fin.vendor}</th>
      <th>${t.fin.category}</th><th>${t.fin.invoiceNo}</th><th>${t.fin.invoice}</th>
    </tr></thead>
    <tbody>
      ${rows}
      <tr class="total-row">
        <td colspan="3" style="text-align:${isAr?'left':'right'}">${isAr?'الإجمالي':'Total'}</td>
        <td style="color:#10b981;font-family:monospace">${total.toLocaleString()} ${t.fin.sar}</td>
        <td colspan="4"></td>
      </tr>
    </tbody>
  </table>
  <div class="footer"><span>${t.appName}</span><span>${date}</span></div>
  <script>window.onload=function(){setTimeout(function(){window.print();},900)};<\/script>
</body></html>`;

  const win = window.open('', '_blank', 'width=1200,height=750');
  if (!win) { alert(isAr ? 'يرجى السماح بالنوافذ المنبثقة' : 'Please allow popups'); return; }
  win.document.write(html);
  win.document.close();
}
