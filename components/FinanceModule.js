import { useState, useEffect, useMemo, useRef } from 'react';
import { getFinance, addFinanceRecord, updateFinanceRecord, deleteFinanceRecord, addAuditEntry } from '../../lib/db';
import { exportExcelFinance, exportPDFFinance } from '../../lib/exportFinance';

const SAR = (n) => new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n || 0);

const CATS_AR = ['أجهزة', 'برمجيات', 'صيانة', 'شبكات', 'استشارات', 'متنوع'];
const CATS_EN = ['Hardware', 'Software', 'Maintenance', 'Networking', 'Consulting', 'Other'];

// ── Mini Bar Chart (pure SVG) ─────────────────────────────────────────────────
function BarChart({ data, dark }) {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  const W = 500, H = 160, pad = 40, barW = Math.min(36, (W - pad * 2) / data.length - 8);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }}>
      {data.map((d, i) => {
        const bh = Math.max(4, ((d.value / max) * (H - pad - 20)));
        const x = pad + i * ((W - pad * 2) / data.length) + ((W - pad * 2) / data.length - barW) / 2;
        const y = H - pad - bh;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={bh} rx="4"
              fill="url(#barGrad)" opacity="0.85" />
            <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize="9"
              fill={dark ? '#64748b' : '#94a3b8'}>{d.label}</text>
            <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize="8"
              fill={dark ? '#94a3b8' : '#64748b'}>{d.value > 0 ? Math.round(d.value / 1000) + 'k' : ''}</text>
          </g>
        );
      })}
      <defs>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#06b6d4"/>
          <stop offset="100%" stopColor="#7c3aed"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// ── Donut Chart (pure SVG) ────────────────────────────────────────────────────
function DonutChart({ data, dark }) {
  if (!data.length) return null;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const colors = ['#06b6d4','#7c3aed','#10b981','#f59e0b','#ef4444','#8b5cf6'];
  let offset = 0;
  const R = 60, cx = 80, cy = 80, stroke = 22;
  const circ = 2 * Math.PI * R;
  return (
    <svg viewBox="0 0 200 160" className="w-full" style={{ height: 160 }}>
      {data.map((d, i) => {
        const pct = d.value / total;
        const dash = pct * circ;
        const gap = circ - dash;
        const el = (
          <circle key={i} cx={cx} cy={cy} r={R}
            fill="none" stroke={colors[i % colors.length]} strokeWidth={stroke}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset * circ}
            style={{ transition: 'all 0.5s' }} />
        );
        offset += pct;
        return el;
      })}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="11" fontWeight="bold" fill={dark ? '#e2e8f0' : '#1e293b'}>
        {Math.round((data[0]?.value / total) * 100)}%
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize="8" fill={dark ? '#64748b' : '#94a3b8'}>
        {data[0]?.label}
      </text>
      {/* Legend */}
      {data.slice(0, 4).map((d, i) => (
        <g key={i} transform={`translate(148, ${20 + i * 28})`}>
          <circle cx="6" cy="6" r="5" fill={colors[i % colors.length]} />
          <text x="14" y="10" fontSize="9" fill={dark ? '#94a3b8' : '#64748b'}>{d.label}</text>
        </g>
      ))}
    </svg>
  );
}

// ── Finance Record Modal ──────────────────────────────────────────────────────
function FinModal({ t, isAr, dark, type, record, onSave, onClose, sheetsUrl }) {
  const cats = isAr ? CATS_AR : CATS_EN;
  const BLANK = { description: '', amount: '', vendor: '', category: cats[0], invoiceNo: '', date: new Date().toISOString().split('T')[0], attachmentUrl: '', attachmentName: '' };
  const [form, setForm] = useState(record || BLANK);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const titles = { purchases: t.fin.addPurchase, expenses: t.fin.addExpense, assets: t.fin.addAsset };

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      set('attachmentUrl', e.target.result);
      set('attachmentName', file.name);
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const inp = `w-full rounded-xl px-3 py-2.5 text-sm outline-none border transition-colors ${
    dark ? 'bg-slate-900/70 border-slate-700/60 text-slate-100 placeholder-slate-600 focus:border-cyan-500/60'
         : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-cyan-500'}`;
  const lbl = `block text-xs font-medium mb-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir={t.dir}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-lg rounded-2xl shadow-2xl fade-up overflow-hidden border ${dark ? 'bg-[#0a1220]/97 border-slate-700/50' : 'bg-white border-slate-200'}`}>
        <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className={`font-semibold text-lg ${dark ? 'text-white' : 'text-slate-800'}`}>{titles[type]}</h3>
            <button onClick={onClose} className={`${dark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={lbl}>{t.fin.description}</label>
              <input value={form.description} onChange={e => set('description', e.target.value)} className={inp} placeholder={isAr ? 'وصف المعاملة' : 'Transaction description'} />
            </div>
            <div>
              <label className={lbl}>{t.fin.amount}</label>
              <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} className={inp} placeholder="0" />
            </div>
            <div>
              <label className={lbl}>{t.fin.date}</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>{t.fin.vendor}</label>
              <input value={form.vendor} onChange={e => set('vendor', e.target.value)} className={inp} placeholder={isAr ? 'اسم المورد' : 'Vendor name'} />
            </div>
            <div>
              <label className={lbl}>{t.fin.category}</label>
              <select value={form.category} onChange={e => set('category', e.target.value)} className={inp}>
                {cats.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>{t.fin.invoiceNo}</label>
              <input value={form.invoiceNo} onChange={e => set('invoiceNo', e.target.value)} className={inp} placeholder="INV-001" />
            </div>
            {/* Invoice attachment */}
            <div className="col-span-2">
              <label className={lbl}>{t.fin.invoice}</label>
              {form.attachmentUrl ? (
                <div className={`flex items-center gap-2 p-2.5 rounded-xl border ${dark ? 'bg-emerald-500/8 border-emerald-500/25' : 'bg-emerald-50 border-emerald-200'}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-emerald-400 shrink-0"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <span className="text-emerald-400 text-xs flex-1 truncate">{form.attachmentName}</span>
                  <button onClick={() => { set('attachmentUrl',''); set('attachmentName',''); }} className="text-slate-500 hover:text-red-400">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              ) : (
                <div onClick={() => fileRef.current.click()}
                  className={`border border-dashed rounded-xl p-3 text-center cursor-pointer text-xs transition-colors ${dark ? 'border-slate-600/50 hover:border-slate-500 text-slate-500' : 'border-slate-300 hover:border-slate-400 text-slate-400'}`}>
                  <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={e => handleFile(e.target.files[0])} />
                  {uploading ? (isAr ? 'جاري التحميل...' : 'Uploading...') : (isAr ? 'ارفع صورة الفاتورة (JPG/PDF)' : 'Upload invoice (JPG/PDF)')}
                </div>
              )}
            </div>
          </div>
          <div className={`flex gap-3 ${isAr ? 'flex-row-reverse' : ''}`}>
            <button onClick={onClose} className={`flex-1 py-2.5 rounded-xl text-sm transition-colors ${dark ? 'bg-slate-700/60 hover:bg-slate-600/70 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>{t.cancel}</button>
            <button onClick={() => { if (form.description && form.amount) { onSave({ ...form, amount: parseFloat(form.amount) || 0 }); onClose(); } }}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-white transition-all active:scale-95">
              {t.save}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Finance Page ──────────────────────────────────────────────────────────
export default function FinancePage({ t, dark, user }) {
  const isAr = t.dir === 'rtl';
  const [tab, setTab]           = useState('purchases');
  const [records, setRecords]   = useState({ purchases: [], expenses: [], assets: [] });
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [sortKey, setSortKey]   = useState('date');
  const [sortAsc, setSortAsc]   = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editRec, setEditRec]   = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [p, e, a] = await Promise.all([
        getFinance('purchases'), getFinance('expenses'), getFinance('assets')
      ]);
      setRecords({ purchases: p, expenses: e, assets: a });
      setLoading(false);
    };
    load();
  }, []);

  const list = useMemo(() => {
    let rows = records[tab] || [];
    if (search) rows = rows.filter(r => r.description?.toLowerCase().includes(search.toLowerCase()) || r.vendor?.toLowerCase().includes(search.toLowerCase()) || r.invoiceNo?.toLowerCase().includes(search.toLowerCase()));
    rows = [...rows].sort((a, b) => {
      const va = a[sortKey] ?? ''; const vb = b[sortKey] ?? '';
      return sortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
    return rows;
  }, [records, tab, search, sortKey, sortAsc]);

  const totals = useMemo(() => ({
    purchases: records.purchases.reduce((s, r) => s + (r.amount || 0), 0),
    expenses:  records.expenses.reduce((s, r) => s + (r.amount || 0), 0),
    assets:    records.assets.reduce((s, r) => s + (r.amount || 0), 0),
  }), [records]);

  const monthlyData = useMemo(() => {
    const months = isAr
      ? ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
      : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const all = [...records.purchases, ...records.expenses];
    return months.map((label, mi) => ({
      label,
      value: all.filter(r => r.date && new Date(r.date).getMonth() === mi).reduce((s, r) => s + (r.amount || 0), 0),
    }));
  }, [records, isAr]);

  const catData = useMemo(() => {
    const all = records[tab] || [];
    const cats = {};
    all.forEach(r => { cats[r.category] = (cats[r.category] || 0) + (r.amount || 0); });
    return Object.entries(cats).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [records, tab]);

  const handleSave = async (form) => {
    const canEdit = user?.role === 'admin' || user?.department === 'finance';
    if (!canEdit) return;
    let saved;
    if (editRec) {
      saved = await updateFinanceRecord(tab, { ...editRec, ...form });
      setRecords(prev => ({ ...prev, [tab]: prev[tab].map(r => r.id === saved.id ? saved : r) }));
    } else {
      saved = await addFinanceRecord(tab, { ...form, addedBy: user?.username });
      setRecords(prev => ({ ...prev, [tab]: [saved, ...prev[tab]] }));
    }
    await addAuditEntry({
      time: new Date().toISOString(), action: editRec ? 'edited' : 'added',
      deviceName: form.description, deviceId: String(saved.id),
      oldVal: editRec ? String(editRec.amount) + ' SAR' : '',
      newVal: String(form.amount) + ' SAR',
      userName: user?.name || user?.username || '', userEmail: user?.email || '',
    });
    setEditRec(null);
  };

  const handleDelete = async (r) => {
    if (!confirm(t.confirmDelete)) return;
    await deleteFinanceRecord(tab, r.id);
    setRecords(prev => ({ ...prev, [tab]: prev[tab].filter(x => x.id !== r.id) }));
    await addAuditEntry({
      time: new Date().toISOString(), action: 'deleted',
      deviceName: r.description, deviceId: String(r.id),
      oldVal: String(r.amount) + ' SAR', newVal: '',
      userName: user?.name || user?.username || '', userEmail: user?.email || '',
    });
  };

  const sort = (key) => { if (sortKey === key) setSortAsc(a => !a); else { setSortKey(key); setSortAsc(false); } };
  const SortIcon = ({ k }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`w-3 h-3 inline ms-1 transition-transform ${sortKey === k ? 'text-cyan-400' : 'opacity-30'} ${sortKey === k && sortAsc ? 'rotate-180' : ''}`}>
      <path d="M6 9l6-6 6 6M6 15l6 6 6-6"/>
    </svg>
  );

  const tabs = [
    { key: 'purchases', label: t.fin.purchases },
    { key: 'expenses',  label: t.fin.expenses  },
    { key: 'assets',    label: t.fin.assets     },
  ];

  const canWrite = user?.role === 'admin' || user?.department === 'finance';

  const card = `rounded-xl border p-4 ${dark ? 'dark:bg-slate-800/40 dark:border-slate-700/40' : 'bg-white border-slate-200 shadow-sm'}`;

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: t.fin.purchases, value: totals.purchases, color: 'text-cyan-400',   icon: '🛒' },
          { label: t.fin.expenses,  value: totals.expenses,  color: 'text-amber-400',  icon: '💳' },
          { label: t.fin.assets,    value: totals.assets,    color: 'text-emerald-400',icon: '🏢' },
        ].map((s, i) => (
          <div key={i} className={card}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xl">{s.icon}</span>
              <span className={`text-xs px-2 py-0.5 rounded-lg ${dark ? 'bg-slate-700/50 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{t.fin.sar}</span>
            </div>
            <p className={`text-xl font-bold font-mono ${s.color}`}>{SAR(s.value)}</p>
            <p className={`text-xs mt-0.5 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={card}>
          <p className={`text-sm font-medium mb-3 ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{t.fin.monthly}</p>
          <BarChart data={monthlyData} dark={dark} />
        </div>
        <div className={card}>
          <p className={`text-sm font-medium mb-3 ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{t.fin.byCategory}</p>
          <DonutChart data={catData} dark={dark} />
        </div>
      </div>

      {/* Tabs + Table */}
      <div className={`rounded-xl border overflow-hidden ${dark ? 'bg-slate-800/30 border-slate-700/40' : 'bg-white border-slate-200 shadow-sm'}`}>
        {/* Tab bar */}
        <div className={`flex items-center justify-between px-4 py-3 border-b ${dark ? 'border-slate-700/40' : 'border-slate-100'} flex-wrap gap-2`}>
          <div className="flex gap-1">
            {tabs.map(tb => (
              <button key={tb.key} onClick={() => setTab(tb.key)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${tab === tb.key ? 'bg-cyan-500 text-white' : dark ? 'bg-slate-700/50 text-slate-400 hover:bg-slate-600/50' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {tb.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.search}
              className={`text-xs px-3 py-1.5 rounded-lg border outline-none w-40 ${dark ? 'bg-slate-900/50 border-slate-700/50 text-slate-100 placeholder-slate-600 focus:border-cyan-500/50' : 'bg-slate-50 border-slate-200 text-slate-700 focus:border-cyan-400'}`} />
            <button onClick={() => exportExcelFinance(list, tab, t)}
              className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all ${dark ? 'bg-emerald-600/20 text-emerald-400 border-emerald-600/25 hover:bg-emerald-600/30' : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'}`}>
              {t.exportExcel}
            </button>
            <button onClick={() => exportPDFFinance(list, tab, t)}
              className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all ${dark ? 'bg-red-600/20 text-red-400 border-red-600/25 hover:bg-red-600/30' : 'bg-red-50 text-red-500 border-red-200 hover:bg-red-100'}`}>
              {t.exportPDF}
            </button>
            {canWrite && (
              <button onClick={() => { setEditRec(null); setShowModal(true); }}
                className="text-xs px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-white font-semibold transition-all active:scale-95">
                + {tabs.find(tb => tb.key === tab)?.label}
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`text-xs uppercase tracking-wider ${dark ? 'bg-slate-800/50 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
                {['description','date','amount','vendor','category','invoiceNo'].map(k => (
                  <th key={k} onClick={() => sort(k)} className="px-4 py-3 font-medium text-start cursor-pointer hover:text-cyan-400 whitespace-nowrap">
                    {t.fin[k] || k} <SortIcon k={k} />
                  </th>
                ))}
                <th className="px-4 py-3 font-medium text-center">{t.fin.invoice}</th>
                {canWrite && <th className="px-4 py-3 font-medium text-center">{t.table.actions}</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" className="text-center py-12">
                  <svg className={`w-6 h-6 animate-spin mx-auto ${dark ? 'text-cyan-500/50' : 'text-cyan-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/>
                  </svg>
                </td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan="8" className="text-center py-12">
                  <p className={`text-sm ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{t.noResults}</p>
                </td></tr>
              ) : list.map(r => (
                <tr key={r.id} className={`border-t transition-colors ${dark ? 'border-slate-700/30 hover:bg-slate-700/15' : 'border-slate-100 hover:bg-slate-50'}`}>
                  <td className={`px-4 py-3 font-medium ${dark ? 'text-slate-200' : 'text-slate-700'} max-w-[180px] truncate`}>{r.description}</td>
                  <td className={`px-4 py-3 text-xs ${dark ? 'text-slate-400' : 'text-slate-500'} whitespace-nowrap`}>{r.date || '—'}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-emerald-400 whitespace-nowrap">{SAR(r.amount)}</td>
                  <td className={`px-4 py-3 text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{r.vendor || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-lg ${dark ? 'bg-cyan-500/10 text-cyan-400' : 'bg-cyan-50 text-cyan-600 border border-cyan-200'}`}>{r.category || '—'}</span>
                  </td>
                  <td className={`px-4 py-3 text-xs font-mono ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{r.invoiceNo || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    {r.attachmentUrl
                      ? <a href={r.attachmentUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:underline">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                          </svg>
                          {isAr ? 'فاتورة' : 'Invoice'}
                        </a>
                      : <span className={`text-xs ${dark ? 'text-slate-600' : 'text-slate-300'}`}>—</span>
                    }
                  </td>
                  {canWrite && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => { setEditRec(r); setShowModal(true); }}
                          className={`p-1.5 rounded-lg transition-all ${dark ? 'text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10' : 'text-slate-400 hover:text-cyan-500 hover:bg-cyan-50'}`}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button onClick={() => handleDelete(r)}
                          className={`p-1.5 rounded-lg transition-all ${dark ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <FinModal t={t} isAr={isAr} dark={dark} type={tab} record={editRec}
          onSave={handleSave} onClose={() => { setShowModal(false); setEditRec(null); }}
          sheetsUrl="" />
      )}
    </div>
  );
}
