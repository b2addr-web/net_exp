import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../components/AuthContext';
import LoginPage from '../components/LoginPage';
import DeviceModal from '../components/DeviceModal';
import UsersPanel from '../components/UsersPanel';
import SettingsPanel from '../components/SettingsPanel';
import { T, INITIAL_DEVICES, TYPE_COLORS, LOC_COLORS } from '../lib/data';
import { exportExcel, exportPDF, saveToSheets } from '../lib/export';
import Head from 'next/head';

const StatusBadge = ({ status, t }) => {
  const s = { new: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20', used: 'bg-blue-500/15 text-blue-400 border border-blue-500/20', damaged: 'bg-red-500/15 text-red-400 border border-red-500/20' };
  return <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${s[status]}`}>{t.statuses[status]}</span>;
};

const TypeBadge = ({ type, t }) => {
  const c = TYPE_COLORS[type] || TYPE_COLORS.accessory;
  return <span className={`text-xs px-2 py-0.5 rounded-md ${c.bg} ${c.text}`}>{t.deviceTypes[type]}</span>;
};

const StatCard = ({ label, value, sub, color, icon }) => (
  <div className={`card-3d glass bg-slate-800/40 border rounded-xl p-4 ${color}`}>
    <div className="flex items-start justify-between mb-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color.replace('border-', 'bg-').replace('/30', '/15')}`}>
        {icon}
      </div>
    </div>
    <p className="text-2xl font-bold text-white font-mono">{value}</p>
    <p className="text-xs text-slate-400 mt-0.5">{label}</p>
    {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
  </div>
);

export default function Dashboard() {
  const { user, logout, ready } = useAuth();
  const [lang, setLang]         = useState('ar');
  const [dark, setDark]         = useState(true);
  const [devices, setDevices]   = useState(INITIAL_DEVICES);
  const [search, setSearch]     = useState('');
  const [typeFilter, setTypeFilter]   = useState('all');
  const [locFilter, setLocFilter]     = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editDevice, setEditDevice]   = useState(null);
  const [showModal, setShowModal]     = useState(false);
  const [showUsers, setShowUsers]     = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sheetsUrl, setSheetsUrl]     = useState('');
  const [sheetsMsg, setSheetsMsg]     = useState('');
  const [activePage, setActivePage]   = useState('dashboard');

  const t = T[lang];

  useEffect(() => {
    if (dark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [dark]);

  useEffect(() => {
    const saved = localStorage.getItem('ne_devices');
    const savedUrl = localStorage.getItem('ne_sheets_url');
    if (saved) try { setDevices(JSON.parse(saved)); } catch {}
    if (savedUrl) setSheetsUrl(savedUrl);
  }, []);

  const persist = (next) => {
    setDevices(next);
    localStorage.setItem('ne_devices', JSON.stringify(next));
  };

  const saveDevice = (form) => {
    const next = editDevice
      ? devices.map(d => d.id === form.id ? form : d)
      : [{ ...form, id: Date.now() }, ...devices];
    persist(next);
    setEditDevice(null);
  };

  const deleteDevice = (id) => {
    if (confirm(t.confirmDelete)) persist(devices.filter(d => d.id !== id));
  };

  const filtered = useMemo(() => {
    return devices.filter(d => {
      const q = search.toLowerCase();
      const matchQ = !q || d.name.toLowerCase().includes(q) || d.serial.toLowerCase().includes(q);
      const matchT = typeFilter === 'all' || d.type === typeFilter;
      const matchL = locFilter === 'all' || d.location === locFilter;
      const matchS = statusFilter === 'all' || d.status === statusFilter;
      return matchQ && matchT && matchL && matchS;
    });
  }, [devices, search, typeFilter, locFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: devices.length,
    online: devices.filter(d => d.online).length,
    offline: devices.filter(d => !d.online).length,
    damaged: devices.filter(d => d.status === 'damaged').length,
    warehouse: devices.filter(d => d.location === 'warehouse').length,
    main: devices.filter(d => d.location === 'main').length,
    factory: devices.filter(d => d.location === 'factory').length,
  }), [devices]);

  const handleSheets = async () => {
    try {
      await saveToSheets(devices, sheetsUrl);
      setSheetsMsg(t.sheetsSaved);
    } catch {
      setSheetsMsg(t.sheetsError);
    }
    setTimeout(() => setSheetsMsg(''), 4000);
  };

  if (!ready) return null;
  if (!user) return <LoginPage t={t} />;

  const isAdmin = user.role === 'admin';

  const navBtn = (page, label, icon) => (
    <button onClick={() => setActivePage(page)}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${activePage === page ? 'bg-cyan-500/15 text-cyan-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`}>
      {icon}<span className="hidden md:block">{label}</span>
    </button>
  );

  return (
    <>
      <Head>
        <title>{t.appName}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="min-h-screen bg-[#060d1a] text-slate-100" dir={t.dir}>
        {/* Background */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute inset-0 opacity-[0.025]"
            style={{ backgroundImage: 'linear-gradient(to right,#3b82f6 1px,transparent 1px),linear-gradient(to bottom,#3b82f6 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full blur-3xl opacity-[0.06]"
            style={{ background: 'radial-gradient(circle, #06b6d4, transparent 70%)' }} />
        </div>

        {/* Navbar */}
        <nav className="sticky top-0 z-40 glass bg-[#0a1220]/80 border-b border-slate-700/40">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
            {/* Logo */}
            <div className="flex items-center gap-2.5 me-4">
              <div className="relative w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-5 h-5 text-cyan-400">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4"/>
                </svg>
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#0a1220] pulse-ring" />
              </div>
              <span className="font-bold text-white hidden sm:block">{t.appName}</span>
            </div>

            {/* Nav links */}
            <div className="flex items-center gap-1">
              {navBtn('dashboard', t.dashboard,
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                </svg>
              )}
              {navBtn('inventory', t.inventory,
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/>
                </svg>
              )}
            </div>

            <div className="flex-1" />

            {/* Controls */}
            <div className="flex items-center gap-2">
              {sheetsMsg && (
                <span className={`text-xs px-3 py-1.5 rounded-lg hidden sm:block ${sheetsMsg.startsWith('✓') ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                  {sheetsMsg}
                </span>
              )}

              {isAdmin && (
                <>
                  <button onClick={() => setShowUsers(true)} title={t.users}
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-all">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
                    </svg>
                  </button>
                  <button onClick={() => setShowSettings(true)} title={t.settings}
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-all">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                      <circle cx="12" cy="12" r="3"/>
                      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
                    </svg>
                  </button>
                </>
              )}

              <button onClick={() => setLang(l => l === 'ar' ? 'en' : 'ar')}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-700/60 hover:bg-slate-600/70 text-slate-300 border border-slate-600/50 transition-all">
                {lang === 'ar' ? 'EN' : 'ع'}
              </button>

              <div className="flex items-center gap-2 ps-2 border-s border-slate-700/40">
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-slate-300 font-medium">{user.name || user.username}</p>
                  <p className="text-xs text-slate-500">{user.role === 'admin' ? t.admin : t.viewer}</p>
                </div>
                <button onClick={logout} title={t.logout}
                  className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </nav>

        <main className="relative z-10 max-w-7xl mx-auto px-4 py-6">
          {/* ── DASHBOARD PAGE ── */}
          {activePage === 'dashboard' && (
            <div className="space-y-6 fade-up">
              <div>
                <h1 className="text-2xl font-bold text-white">{t.dashboard}</h1>
                <p className="text-slate-500 text-sm mt-1">{t.appSub}</p>
              </div>

              {/* Online bar */}
              <div className="glass bg-slate-800/30 border border-slate-700/40 rounded-xl p-4 flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 pulse-ring" />
                  <span className="text-emerald-400 text-sm font-medium">{stats.online} {t.online}</span>
                </div>
                <span className="text-slate-600">·</span>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-500" />
                  <span className="text-slate-400 text-sm">{stats.offline} {t.offline}</span>
                </div>
                <div className="flex-1 min-w-24 mx-2">
                  <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full transition-all duration-700"
                      style={{ width: `${stats.total ? (stats.online / stats.total) * 100 : 0}%` }} />
                  </div>
                </div>
                <span className="text-emerald-400 font-mono font-bold text-sm">
                  {stats.total ? Math.round((stats.online / stats.total) * 100) : 0}%
                </span>
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: t.total, value: stats.total, color: 'border-slate-700/50',
                    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5 text-slate-400"><rect x="2" y="3" width="20" height="5" rx="1"/><rect x="2" y="10" width="20" height="5" rx="1"/></svg> },
                  { label: t.online, value: stats.online, color: 'border-emerald-500/25',
                    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5 text-emerald-400"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg> },
                  { label: t.offline, value: stats.offline, color: 'border-slate-600/30',
                    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5 text-slate-400"><circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l14.14 14.14"/></svg> },
                  { label: t.dir === 'rtl' ? 'تالف' : 'Damaged', value: stats.damaged, color: 'border-red-500/25',
                    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5 text-red-400"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
                  { label: t.locations.warehouse, value: stats.warehouse, color: 'border-amber-500/25',
                    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5 text-amber-400"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg> },
                  { label: t.locations.factory, value: stats.factory, color: 'border-violet-500/25',
                    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5 text-violet-400"><path d="M2 20h20M4 20V8l6-4 6 4v12M10 20v-6h4v6"/></svg> },
                ].map((s, i) => <StatCard key={i} {...s} />)}
              </div>

              {/* Type breakdown */}
              <div className="glass bg-slate-800/30 border border-slate-700/40 rounded-xl p-5">
                <h2 className="text-white font-semibold mb-4">{t.dir === 'rtl' ? 'توزيع الأجهزة حسب النوع' : 'Devices by Type'}</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Object.entries(t.deviceTypes).map(([type, label]) => {
                    const count = devices.filter(d => d.type === type).length;
                    const c = TYPE_COLORS[type] || TYPE_COLORS.accessory;
                    return (
                      <button key={type} onClick={() => { setTypeFilter(type); setActivePage('inventory'); }}
                        className={`card-3d text-start p-3 rounded-xl border ${c.border} ${c.bg} hover:opacity-90 transition-all`}>
                        <p className={`text-xl font-bold font-mono ${c.text}`}>{count}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{label}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── INVENTORY PAGE ── */}
          {activePage === 'inventory' && (
            <div className="space-y-4 fade-up">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h1 className="text-2xl font-bold text-white">{t.inventory}</h1>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Export buttons */}
                  <button onClick={() => exportExcel(filtered, t)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-600/25 transition-all">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                    </svg>
                    {t.exportExcel}
                  </button>
                  <button onClick={() => exportPDF(filtered, t)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/25 transition-all">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    </svg>
                    {t.exportPDF}
                  </button>
                  {isAdmin && sheetsUrl && (
                    <button onClick={handleSheets}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/25 transition-all">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                      </svg>
                      {t.saveSheets}
                    </button>
                  )}
                  {isAdmin && (
                    <button onClick={() => { setEditDevice(null); setShowModal(true); }}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-white text-sm font-semibold transition-all shadow-lg shadow-cyan-500/25 active:scale-95">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                        <path d="M12 5v14M5 12h14"/>
                      </svg>
                      {t.addDevice}
                    </button>
                  )}
                </div>
              </div>

              {/* Filters */}
              <div className="glass bg-slate-800/30 border border-slate-700/40 rounded-xl p-4 space-y-3">
                {/* Search */}
                <div className="relative">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none ${t.dir === 'rtl' ? 'right-3' : 'left-3'}`}>
                    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                  </svg>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.search}
                    className={`w-full bg-slate-900/50 border border-slate-700/50 text-slate-100 rounded-xl py-2.5 text-sm outline-none focus:border-cyan-500/50 transition-colors placeholder-slate-600 ${t.dir === 'rtl' ? 'pr-9 pl-4' : 'pl-9 pr-4'}`} />
                </div>

                {/* Filter chips row */}
                <div className="flex gap-2 flex-wrap">
                  {/* Type */}
                  <div className="flex gap-1.5 flex-wrap">
                    {['all', ...Object.keys(t.deviceTypes)].map(f => (
                      <button key={f} onClick={() => setTypeFilter(f)}
                        className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${typeFilter === f ? 'bg-cyan-500 text-white' : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600/50'}`}>
                        {f === 'all' ? t.all : t.deviceTypes[f]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {/* Location */}
                  {['all', ...Object.keys(t.locations)].map(f => (
                    <button key={f} onClick={() => setLocFilter(f)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${locFilter === f ? 'bg-violet-500 text-white' : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600/50'}`}>
                      {f === 'all' ? t.all : t.locations[f]}
                    </button>
                  ))}
                  <span className="text-slate-600 px-1">|</span>
                  {/* Status */}
                  {['all', ...Object.keys(t.statuses)].map(f => (
                    <button key={f} onClick={() => setStatusFilter(f)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${statusFilter === f ? 'bg-amber-500 text-white' : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600/50'}`}>
                      {f === 'all' ? t.all : t.statuses[f]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table */}
              <div className="glass bg-slate-800/30 border border-slate-700/40 rounded-xl overflow-hidden">
                <div className={`flex items-center justify-between px-4 py-3 border-b border-slate-700/40`}>
                  <span className="text-sm font-medium text-slate-300">
                    {filtered.length} {t.dir === 'rtl' ? 'جهاز' : 'devices'}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-800/50 text-slate-400 text-xs uppercase tracking-wider">
                        <th className="px-4 py-3 font-medium text-start w-10">#</th>
                        <th className="px-4 py-3 font-medium text-start">{t.table.name}</th>
                        <th className="px-4 py-3 font-medium text-start">{t.table.type}</th>
                        <th className="px-4 py-3 font-medium text-start">{t.table.status}</th>
                        <th className="px-4 py-3 font-medium text-start">{t.table.serial}</th>
                        <th className="px-4 py-3 font-medium text-start">{t.table.location}</th>
                        <th className="px-4 py-3 font-medium text-center">{t.table.connection}</th>
                        {isAdmin && <th className="px-4 py-3 font-medium text-center">{t.table.actions}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr><td colSpan={isAdmin ? 8 : 7} className="text-center py-16">
                          <div className="flex flex-col items-center gap-3 text-slate-500">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-10 h-10 opacity-40">
                              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                            </svg>
                            <span>{t.noResults}</span>
                          </div>
                        </td></tr>
                      ) : filtered.map((d, i) => {
                        const c = TYPE_COLORS[d.type] || TYPE_COLORS.accessory;
                        return (
                          <tr key={d.id} className="border-t border-slate-700/30 hover:bg-slate-700/15 transition-colors">
                            <td className="px-4 py-3 text-slate-600 font-mono text-xs">{String(i + 1).padStart(2, '0')}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${c.bg} ${c.text} border ${c.border} shrink-0`}>
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5">
                                    <rect x="2" y="3" width="20" height="5" rx="1"/><path d="M12 8v12M8 16h8"/>
                                  </svg>
                                </div>
                                <span className="font-medium text-slate-200">{d.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3"><TypeBadge type={d.type} t={t} /></td>
                            <td className="px-4 py-3"><StatusBadge status={d.status} t={t} /></td>
                            <td className="px-4 py-3 font-mono text-xs text-slate-400 tracking-wider">{d.serial}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2.5 py-1 rounded-lg border ${LOC_COLORS[d.location] || 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                                {t.locations[d.location]}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {d.online
                                ? <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-ring" />{t.online}
                                  </span>
                                : <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />{t.offline}
                                  </span>
                              }
                            </td>
                            {isAdmin && (
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-center gap-1">
                                  <button onClick={() => { setEditDevice(d); setShowModal(true); }}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all" title={t.edit}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                    </svg>
                                  </button>
                                  <button onClick={() => deleteDevice(d.id)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all" title={t.delete}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                                      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Modals */}
        {showModal && (
          <DeviceModal t={t} device={editDevice} onSave={saveDevice} onClose={() => { setShowModal(false); setEditDevice(null); }} />
        )}
        {showUsers && <UsersPanel t={t} onClose={() => setShowUsers(false)} />}
        {showSettings && (
          <SettingsPanel t={t} sheetsUrl={sheetsUrl}
            onSave={(url) => { setSheetsUrl(url); localStorage.setItem('ne_sheets_url', url); }}
            onClose={() => setShowSettings(false)} />
        )}
      </div>
    </>
  );
}
