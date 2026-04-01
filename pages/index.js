import { useState, useMemo, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useAuth } from '../components/AuthContext';
import { useTheme } from '../components/ThemeContext';
import { usePermission, canAccessPage } from '../lib/rbac';
import LoginPage from '../components/LoginPage';
import DeviceModal from '../components/DeviceModal';
import UsersPanel from '../components/UsersPanel';
import SettingsPanel from '../components/SettingsPanel';
import AuditLogPanel from '../components/AuditLogPanel';
import AccountSettings from '../components/AccountSettings';
import FinanceModule from '../components/FinanceModule';
import { T, TYPE_COLORS, LOC_COLORS } from '../lib/data';
import { getDevices, addDevice, updateDevice, deleteDevice, getAuditLog, addAuditEntry } from '../lib/db';
import { exportExcel, exportPDF, saveToSheets } from '../lib/export';
import { supabase } from '../lib/supabase';

// ── Badges ─────────────────────────────────────────────────────────────────────
const StatusBadge = ({ status, t, dark }) => {
  const s = {
    new:     dark ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border border-emerald-200',
    used:    dark ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'          : 'bg-blue-50 text-blue-600 border border-blue-200',
    damaged: dark ? 'bg-red-500/15 text-red-400 border border-red-500/20'             : 'bg-red-50 text-red-600 border border-red-200',
  };
  return <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${s[status] || (dark?'bg-slate-700 text-slate-400':'bg-slate-100 text-slate-500')}`}>{t.statuses[status] || status}</span>;
};

const TypeBadge = ({ type, t, dark }) => {
  const c = TYPE_COLORS[type] || TYPE_COLORS.accessory;
  return <span className={`text-xs px-2 py-0.5 rounded-md ${dark ? `${c.bg} ${c.text}` : 'bg-slate-100 text-slate-600'}`}>{t.deviceTypes[type] || type}</span>;
};

function buildAuditEntry(action, device, oldDevice, user) {
  const changes = [];
  if (action === 'edited' && oldDevice) {
    ['name','type','status','serial','location','online','employee','empId'].forEach(f => {
      if (String(oldDevice[f]??'') !== String(device[f]??''))
        changes.push(`${f}: ${oldDevice[f]??''} → ${device[f]??''}`);
    });
  }
  return {
    time: new Date().toISOString(), action,
    deviceName: device.name, deviceId: String(device.id),
    oldVal: action==='deleted' ? device.name : changes.join(' | ') || '',
    newVal: action==='added'   ? device.name : changes.join(' | ') || '',
    userName: user?.name || user?.username || 'unknown',
    userEmail: user?.email || '',
  };
}

// ── Access Denied screen ───────────────────────────────────────────────────────
const AccessDenied = ({ t, dark }) => (
  <div className="flex flex-col items-center justify-center py-24 gap-4">
    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${dark ? 'bg-red-500/10' : 'bg-red-50'} border ${dark ? 'border-red-500/20' : 'border-red-200'}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-8 h-8 text-red-400">
        <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    </div>
    <p className={`text-sm font-medium ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{t.accessDenied}</p>
  </div>
);

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, logout, ready } = useAuth();
  const { dark, toggle: toggleTheme } = useTheme();
  const perm = usePermission(user);

  const [lang, setLang]           = useState('ar');
  const [devices, setDevices]     = useState([]);
  const [auditLog, setAuditLog]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [dbMode, setDbMode]       = useState('local');
  const [activePage, setActivePage] = useState('dashboard');

  const [search, setSearch]           = useState('');
  const [typeFilter, setTypeFilter]   = useState('all');
  const [locFilter, setLocFilter]     = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortKey, setSortKey]         = useState('name');
  const [sortAsc, setSortAsc]         = useState(true);

  const [editDevice, setEditDevice]     = useState(null);
  const [showModal, setShowModal]       = useState(false);
  const [showUsers, setShowUsers]       = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAudit, setShowAudit]       = useState(false);
  const [showAccount, setShowAccount]   = useState(false);
  const [sheetsUrl, setSheetsUrl]       = useState('');
  const [sheetsMsg, setSheetsMsg]       = useState('');

  const t = T[lang];

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [devs, audit] = await Promise.all([getDevices(), getAuditLog()]);
      setDevices(devs);
      setAuditLog(audit);
      setDbMode(supabase ? 'cloud' : 'local');
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { if (user) loadData(); }, [user, loadData]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = localStorage.getItem('ne_sheets_url');
      if (url) setSheetsUrl(url);
    }
  }, []);

  useEffect(() => {
    if (!supabase || !user) return;
    const ch = supabase.channel('rt')
      .on('postgres_changes', { event:'*', schema:'public', table:'devices' }, loadData)
      .on('postgres_changes', { event:'*', schema:'public', table:'audit_log' }, loadData)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [user, loadData]);

  // ── CRUD ──────────────────────────────────────────────────────────────────────
  const saveDevice = async (form) => {
    try {
      if (editDevice) {
        const updated = await updateDevice(form);
        setDevices(prev => prev.map(d => d.id===updated.id ? updated : d));
        const e = buildAuditEntry('edited', updated, editDevice, user);
        const saved = await addAuditEntry(e);
        setAuditLog(prev => [...prev, saved]);
      } else {
        const created = await addDevice(form);
        setDevices(prev => [created, ...prev]);
        const e = buildAuditEntry('added', created, null, user);
        const saved = await addAuditEntry(e);
        setAuditLog(prev => [...prev, saved]);
      }
    } catch(e) { console.error(e); }
    setEditDevice(null);
  };

  const handleDelete = async (d) => {
    if (!confirm(t.confirmDelete)) return;
    await deleteDevice(d.id);
    setDevices(prev => prev.filter(x => x.id!==d.id));
    const e = buildAuditEntry('deleted', d, null, user);
    const saved = await addAuditEntry(e);
    setAuditLog(prev => [...prev, saved]);
  };

  // ── Sort + Filter ──────────────────────────────────────────────────────────────
  const sortBy = (key) => { if (sortKey===key) setSortAsc(a=>!a); else { setSortKey(key); setSortAsc(true); } };
  const SortIcon = ({ k }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`w-3 h-3 inline ms-1 ${sortKey===k?'text-cyan-400':'opacity-20'} ${sortKey===k&&!sortAsc?'rotate-180':''} transition-transform`}>
      <path d="M6 9l6-6 6 6M6 15l6 6 6-6"/>
    </svg>
  );

  const filtered = useMemo(() => {
    let list = devices.filter(d => {
      const q = search.toLowerCase();
      const mQ = !q || d.name?.toLowerCase().includes(q) || d.serial?.toLowerCase().includes(q) || (d.employee||'').toLowerCase().includes(q);
      const mT = typeFilter==='all' || d.type===typeFilter;
      const mL = locFilter==='all'  || d.location===locFilter;
      const mS = statusFilter==='all' || d.status===statusFilter;
      return mQ && mT && mL && mS;
    });
    list = [...list].sort((a,b) => {
      const va = a[sortKey]??''; const vb = b[sortKey]??'';
      return sortAsc ? (va>vb?1:-1) : (va<vb?1:-1);
    });
    return list;
  }, [devices, search, typeFilter, locFilter, statusFilter, sortKey, sortAsc]);

  const stats = useMemo(() => ({
    total:    devices.length,
    online:   devices.filter(d=>d.online).length,
    offline:  devices.filter(d=>!d.online).length,
    damaged:  devices.filter(d=>d.status==='damaged').length,
    newCount: devices.filter(d=>d.status==='new').length,
    warehouse:devices.filter(d=>d.location==='warehouse').length,
    main:     devices.filter(d=>d.location==='main').length,
    factory:  devices.filter(d=>d.location==='factory').length,
  }), [devices]);

  const handleSheets = async () => {
    try { await saveToSheets(devices, auditLog, sheetsUrl); setSheetsMsg(t.sheetsSaved); }
    catch { setSheetsMsg(t.sheetsError); }
    setTimeout(() => setSheetsMsg(''), 4000);
  };

  if (!ready) return null;
  if (!user)  return <LoginPage t={t} />;

  // Theme classes
  const bg      = dark ? 'bg-[#060d1a] text-slate-100'     : 'bg-[#f0f4ff] text-slate-800';
  const navBg   = dark ? 'bg-[#0a1220]/80 border-slate-700/40' : 'bg-white/80 border-slate-200';
  const cardBg  = dark ? 'bg-slate-800/40 border-slate-700/40' : 'bg-white border-slate-200 shadow-sm';
  const tableBg = dark ? 'bg-slate-800/30 border-slate-700/40' : 'bg-white border-slate-200 shadow-sm';
  const rowHov  = dark ? 'border-slate-700/30 hover:bg-slate-700/15' : 'border-slate-100 hover:bg-slate-50';
  const thBg    = dark ? 'bg-slate-800/50 text-slate-400'   : 'bg-slate-50 text-slate-500';

  const navBtn = (page, label, icon) => {
    const allowed = canAccessPage(user, page);
    if (!allowed && page !== 'dashboard') return null;
    return (
      <button onClick={() => setActivePage(page)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
          activePage===page
            ? 'bg-cyan-500/15 text-cyan-400'
            : dark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
        }`}>
        {icon}<span className="hidden md:block">{label}</span>
      </button>
    );
  };

  return (
    <>
      <Head><title>{t.appName}</title><meta name="viewport" content="width=device-width,initial-scale=1"/></Head>
      <div className={`min-h-screen transition-colors duration-300 ${bg}`}>

        {/* Background (dark only) */}
        {dark && (
          <div className="fixed inset-0 pointer-events-none overflow-hidden">
            <div className="absolute inset-0 opacity-[0.025]"
              style={{ backgroundImage:'linear-gradient(to right,#3b82f6 1px,transparent 1px),linear-gradient(to bottom,#3b82f6 1px,transparent 1px)', backgroundSize:'48px 48px' }} />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full blur-3xl opacity-[0.06]"
              style={{ background:'radial-gradient(circle,#06b6d4,transparent 70%)' }} />
          </div>
        )}

        {/* Navbar */}
        <nav className={`sticky top-0 z-40 glass border-b ${navBg}`} dir={t.dir}>
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
            {/* Logo */}
            <div className="flex items-center gap-2.5 me-4">
              <div className={`relative w-9 h-9 rounded-xl flex items-center justify-center border ${dark?'bg-cyan-500/10 border-cyan-500/25':'bg-cyan-50 border-cyan-200'}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-5 h-5 text-cyan-400">
                  <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4"/>
                </svg>
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 pulse-ring"
                  style={{ background:dbMode==='cloud'?'#34d399':'#f59e0b', borderColor:dark?'#0a1220':'#f0f4ff' }} />
              </div>
              <div className="hidden sm:block">
                <p className={`font-bold text-sm leading-tight ${dark?'text-white':'text-slate-800'}`}>{t.appName}</p>
                <p className="text-xs leading-tight" style={{ color:dbMode==='cloud'?'#34d399':'#f59e0b' }}>
                  {dbMode==='cloud' ? (t.dir==='rtl'?'● سحابي':'● Cloud') : (t.dir==='rtl'?'● محلي':'● Local')}
                </p>
              </div>
            </div>

            {/* Nav links */}
            <div className="flex items-center gap-1">
              {navBtn('dashboard', t.dashboard,
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                </svg>
              )}
              {canAccessPage(user,'inventory') && navBtn('inventory', t.inventory,
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/>
                </svg>
              )}
              {canAccessPage(user,'finance') && navBtn('finance', t.finance,
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
                </svg>
              )}
            </div>

            <div className="flex-1" />

            <div className="flex items-center gap-2">
              {sheetsMsg && (
                <span className={`text-xs px-3 py-1.5 rounded-lg hidden sm:block ${sheetsMsg.startsWith('✓')?'bg-emerald-500/15 text-emerald-400':'bg-red-500/15 text-red-400'}`}>
                  {sheetsMsg}
                </span>
              )}

              {/* Theme toggle */}
              <button onClick={toggleTheme} title={dark ? t.lightMode : t.darkMode}
                className={`p-2 rounded-lg transition-all ${dark?'text-amber-400 hover:bg-amber-500/10':'text-slate-500 hover:bg-slate-100'}`}>
                {dark
                  ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                      <circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                    </svg>
                  : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                    </svg>
                }
              </button>

              {/* Refresh */}
              {dbMode==='cloud' && (
                <button onClick={loadData} className={`p-2 rounded-lg transition-all ${dark?'text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10':'text-slate-400 hover:text-cyan-500 hover:bg-cyan-50'}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`w-4 h-4 ${loading?'animate-spin':''}`}>
                    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                  </svg>
                </button>
              )}

              {/* Audit */}
              <button onClick={() => setShowAudit(true)}
                className={`relative p-2 rounded-lg transition-all ${dark?'text-slate-400 hover:text-amber-400 hover:bg-amber-500/10':'text-slate-400 hover:text-amber-500 hover:bg-amber-50'}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
                {auditLog.length>0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-amber-400 text-black text-[9px] font-bold rounded-full flex items-center justify-center">
                    {auditLog.length>99?'99':auditLog.length}
                  </span>
                )}
              </button>

              {perm.isAdmin && (
                <>
                  <button onClick={() => setShowUsers(true)}
                    className={`p-2 rounded-lg transition-all ${dark?'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50':'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                    </svg>
                  </button>
                  <button onClick={() => setShowSettings(true)}
                    className={`p-2 rounded-lg transition-all ${dark?'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50':'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                      <circle cx="12" cy="12" r="3"/>
                      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
                    </svg>
                  </button>
                </>
              )}

              <button onClick={() => setLang(l=>l==='ar'?'en':'ar')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${dark?'bg-slate-700/60 hover:bg-slate-600/70 text-slate-300 border-slate-600/50':'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'}`}>
                {lang==='ar'?'EN':'ع'}
              </button>

              {/* User menu */}
              <div className={`flex items-center gap-2 ps-2 border-s ${dark?'border-slate-700/40':'border-slate-200'}`}>
                <button onClick={() => setShowAccount(true)}
                  className={`hidden sm:flex flex-col items-end transition-colors cursor-pointer ${dark?'hover:text-cyan-400':'hover:text-cyan-500'}`}>
                  <p className={`text-xs font-medium leading-tight ${dark?'text-slate-300':'text-slate-700'}`}>{user.name||user.username}</p>
                  <p className={`text-xs leading-tight ${dark?'text-slate-500':'text-slate-400'}`}>
                    {user.role==='admin' ? t.admin : (t.departments?.[user.department] || t.viewer)}
                  </p>
                </button>
                <button onClick={logout} title={t.logout}
                  className={`p-2 rounded-lg transition-all ${dark?'text-slate-500 hover:text-red-400 hover:bg-red-500/10':'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </nav>

        {/* Loading bar */}
        {loading && <div className="fixed top-0 left-0 w-full h-0.5 z-50 bg-cyan-400/30"><div className="h-full bg-cyan-400 animate-pulse" style={{width:'60%'}}/></div>}

        <main className="relative z-10 max-w-7xl mx-auto px-4 py-6" dir={t.dir}>

          {/* ── DASHBOARD ── */}
          {activePage==='dashboard' && (
            <div className="space-y-6 fade-up">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <h1 className={`text-2xl font-bold ${dark?'text-white':'text-slate-800'}`}>{t.dashboard}</h1>
                  <p className={`text-sm mt-1 ${dark?'text-slate-500':'text-slate-400'}`}>{t.appSub}</p>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium ${
                  dbMode==='cloud'
                    ? dark?'bg-emerald-500/10 border-emerald-500/25 text-emerald-400':'bg-emerald-50 border-emerald-200 text-emerald-600'
                    : dark?'bg-amber-500/10 border-amber-500/25 text-amber-400':'bg-amber-50 border-amber-200 text-amber-600'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${dbMode==='cloud'?'bg-emerald-400 pulse-ring':'bg-amber-400'}`} />
                  {dbMode==='cloud'?(t.dir==='rtl'?'متصل بـ Supabase':'Connected to Supabase'):(t.dir==='rtl'?'وضع محلي':'Local mode')}
                </div>
              </div>

              {/* Online bar */}
              <div className={`flex items-center gap-4 p-4 rounded-xl border flex-wrap ${dark?'glass bg-slate-800/30 border-slate-700/40':'bg-white border-slate-200 shadow-sm'}`}>
                <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400 pulse-ring"/><span className="text-emerald-400 text-sm font-medium">{stats.online} {t.online}</span></div>
                <span className={dark?'text-slate-600':'text-slate-300'}>·</span>
                <div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${dark?'bg-slate-500':'bg-slate-300'}`}/><span className={`text-sm ${dark?'text-slate-400':'text-slate-500'}`}>{stats.offline} {t.offline}</span></div>
                <div className="flex-1 min-w-24 mx-2">
                  <div className={`h-1.5 rounded-full overflow-hidden ${dark?'bg-slate-700':'bg-slate-200'}`}>
                    <div className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full transition-all duration-700"
                      style={{width:`${stats.total?(stats.online/stats.total)*100:0}%`}}/>
                  </div>
                </div>
                <span className="text-emerald-400 font-mono font-bold text-sm">{stats.total?Math.round((stats.online/stats.total)*100):0}%</span>
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                {[
                  {label:t.total,             value:stats.total,    color:dark?'border-slate-700/50':'border-slate-200',
                    icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5 text-slate-400"><rect x="2" y="3" width="20" height="5" rx="1"/><rect x="2" y="10" width="20" height="5" rx="1"/></svg>},
                  {label:t.online,            value:stats.online,   color:'border-emerald-500/25',
                    icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5 text-emerald-400"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>},
                  {label:t.offline,           value:stats.offline,  color:'border-slate-600/30',
                    icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5 text-slate-400"><circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l14.14 14.14"/></svg>},
                  {label:t.statuses.damaged,  value:stats.damaged,  color:'border-red-500/25',
                    icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5 text-red-400"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/></svg>},
                  {label:t.statuses.new,      value:stats.newCount, color:'border-teal-500/25',
                    icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5 text-teal-400"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>},
                  {label:t.locations.warehouse,value:stats.warehouse,color:'border-amber-500/25',
                    icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5 text-amber-400"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>},
                  {label:t.locations.main,    value:stats.main,     color:'border-cyan-500/25',
                    icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5 text-cyan-400"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-4 0v2"/></svg>},
                  {label:t.locations.factory, value:stats.factory,  color:'border-violet-500/25',
                    icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5 text-violet-400"><path d="M2 20h20M4 20V8l6-4 6 4v12M10 20v-6h4v6"/></svg>},
                ].map((s,i) => (
                  <div key={i} className={`card-3d rounded-xl border p-4 ${dark?`glass bg-slate-800/40 ${s.color}`:`bg-white shadow-sm ${s.color}`}`}>
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${dark?'bg-slate-700/40':'bg-slate-50'}`}>{s.icon}</div>
                    <p className={`text-2xl font-bold font-mono ${dark?'text-white':'text-slate-800'}`}>{s.value}</p>
                    <p className={`text-xs mt-0.5 ${dark?'text-slate-400':'text-slate-500'}`}>{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Type breakdown */}
              <div className={`rounded-xl border p-5 ${dark?'glass bg-slate-800/30 border-slate-700/40':'bg-white border-slate-200 shadow-sm'}`}>
                <h2 className={`font-semibold mb-4 ${dark?'text-white':'text-slate-800'}`}>{t.dir==='rtl'?'توزيع الأجهزة حسب النوع':'Devices by Type'}</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                  {Object.entries(t.deviceTypes).map(([type,label]) => {
                    const count = devices.filter(d=>d.type===type).length;
                    const c = TYPE_COLORS[type]||TYPE_COLORS.accessory;
                    return (
                      <button key={type} onClick={() => { setTypeFilter(type); setActivePage('inventory'); }}
                        className={`card-3d text-start p-3 rounded-xl border transition-all ${dark?`${c.border} ${c.bg}`:'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}>
                        <p className={`text-xl font-bold font-mono ${dark?c.text:'text-slate-800'}`}>{count}</p>
                        <p className={`text-xs mt-0.5 ${dark?'text-slate-400':'text-slate-500'}`}>{label}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Recent audit */}
              {auditLog.length>0 && (
                <div className={`rounded-xl border p-5 ${dark?'glass bg-slate-800/30 border-slate-700/40':'bg-white border-slate-200 shadow-sm'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className={`font-semibold ${dark?'text-white':'text-slate-800'}`}>{t.dir==='rtl'?'آخر العمليات':'Recent Activity'}</h2>
                    <button onClick={() => setShowAudit(true)} className="text-xs text-amber-400 hover:underline">{t.dir==='rtl'?'عرض الكل':'View All'}</button>
                  </div>
                  <div className="space-y-2">
                    {[...auditLog].reverse().slice(0,5).map((e,i) => (
                      <div key={i} className="flex items-center gap-3 text-xs">
                        <span className={`shrink-0 px-2 py-0.5 rounded-md border font-medium ${
                          e.action==='added'?'bg-emerald-500/10 text-emerald-400 border-emerald-500/20':
                          e.action==='edited'?'bg-blue-500/10 text-blue-400 border-blue-500/20':
                          'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                          {t.audit[e.action]||e.action}
                        </span>
                        <span className={`flex-1 truncate ${dark?'text-slate-300':'text-slate-600'}`}>{e.deviceName}</span>
                        <span className={dark?'text-slate-500':'text-slate-400'}>{e.userName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── INVENTORY ── */}
          {activePage==='inventory' && (
            !canAccessPage(user,'inventory') ? <AccessDenied t={t} dark={dark} /> :
            <div className="space-y-4 fade-up">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h1 className={`text-2xl font-bold ${dark?'text-white':'text-slate-800'}`}>{t.inventory}</h1>
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => exportExcel(filtered,t)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border transition-all ${dark?'bg-emerald-600/20 text-emerald-400 border-emerald-600/25 hover:bg-emerald-600/30':'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    {t.exportExcel}
                  </button>
                  <button onClick={() => exportPDF(filtered,t)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border transition-all ${dark?'bg-red-600/20 text-red-400 border-red-600/25 hover:bg-red-600/30':'bg-red-50 text-red-500 border-red-200 hover:bg-red-100'}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    {t.exportPDF}
                  </button>
                  {perm.isAdmin && sheetsUrl && (
                    <button onClick={handleSheets}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border transition-all ${dark?'bg-green-600/20 text-green-400 border-green-600/25 hover:bg-green-600/30':'bg-green-50 text-green-600 border-green-200 hover:bg-green-100'}`}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                      {t.saveSheets}
                    </button>
                  )}
                  {perm.can('write') && (
                    <button onClick={() => { setEditDevice(null); setShowModal(true); }}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-white text-sm font-semibold transition-all shadow-lg shadow-cyan-500/25 active:scale-95">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><path d="M12 5v14M5 12h14"/></svg>
                      {t.addDevice}
                    </button>
                  )}
                </div>
              </div>

              {/* Filters */}
              <div className={`rounded-xl border p-4 space-y-3 ${dark?'glass bg-slate-800/30 border-slate-700/40':'bg-white border-slate-200 shadow-sm'}`}>
                <div className="relative">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${dark?'text-slate-500':'text-slate-400'} ${t.dir==='rtl'?'right-3':'left-3'}`}>
                    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                  </svg>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.search}
                    className={`w-full rounded-xl py-2.5 text-sm outline-none border transition-colors ${t.dir==='rtl'?'pr-9 pl-4':'pl-9 pr-4'} ${dark?'bg-slate-900/50 border-slate-700/50 text-slate-100 placeholder-slate-600 focus:border-cyan-500/50':'bg-slate-50 border-slate-200 text-slate-800 focus:border-cyan-400'}`} />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {['all',...Object.keys(t.deviceTypes)].map(f => (
                    <button key={f} onClick={() => setTypeFilter(f)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${typeFilter===f?'bg-cyan-500 text-white':dark?'bg-slate-700/50 text-slate-400 hover:bg-slate-600/50':'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                      {f==='all'?t.all:t.deviceTypes[f]}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {['all',...Object.keys(t.locations)].map(f => (
                    <button key={f} onClick={() => setLocFilter(f)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${locFilter===f?'bg-violet-500 text-white':dark?'bg-slate-700/50 text-slate-400 hover:bg-slate-600/50':'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                      {f==='all'?t.all:t.locations[f]}
                    </button>
                  ))}
                  <span className={dark?'text-slate-600 px-1':'text-slate-300 px-1'}>|</span>
                  {['all',...Object.keys(t.statuses)].map(f => (
                    <button key={f} onClick={() => setStatusFilter(f)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${statusFilter===f?'bg-amber-500 text-white':dark?'bg-slate-700/50 text-slate-400 hover:bg-slate-600/50':'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                      {f==='all'?t.all:t.statuses[f]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table */}
              <div className={`rounded-xl border overflow-hidden ${dark?'glass bg-slate-800/30 border-slate-700/40':'bg-white border-slate-200 shadow-sm'}`}>
                <div className={`flex items-center justify-between px-4 py-3 border-b ${dark?'border-slate-700/40':'border-slate-100'}`}>
                  <span className={`text-sm font-medium ${dark?'text-slate-300':'text-slate-600'}`}>{filtered.length} {t.dir==='rtl'?'جهاز':'devices'}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={`text-xs uppercase tracking-wider ${thBg}`}>
                        <th className="px-4 py-3 font-medium text-start w-8">#</th>
                        {[['name',t.table.name],['type',t.table.type],['status',t.table.status],['serial',t.table.serial],['location',t.table.location]].map(([k,l])=>(
                          <th key={k} onClick={() => sortBy(k)} className="px-4 py-3 font-medium text-start cursor-pointer hover:text-cyan-400 whitespace-nowrap">
                            {l}<SortIcon k={k}/>
                          </th>
                        ))}
                        <th className="px-4 py-3 font-medium text-start">{t.table.employee}</th>
                        <th onClick={() => sortBy('addedAt')} className="px-4 py-3 font-medium text-start cursor-pointer hover:text-cyan-400 whitespace-nowrap">
                          {t.table.addedAt}<SortIcon k="addedAt"/>
                        </th>
                        <th className="px-4 py-3 font-medium text-center">{t.table.connection}</th>
                        <th className="px-4 py-3 font-medium text-start">{t.table.notes}</th>
                        <th className="px-4 py-3 font-medium text-center">{t.table.attachment}</th>
                        {perm.can('write') && <th className="px-4 py-3 font-medium text-center">{t.table.actions}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={perm.can('write')?12:11} className="text-center py-16">
                          <svg className="w-6 h-6 animate-spin mx-auto text-cyan-500/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/>
                          </svg>
                        </td></tr>
                      ) : filtered.length===0 ? (
                        <tr><td colSpan={perm.can('write')?12:11} className="text-center py-16">
                          <p className={`text-sm ${dark?'text-slate-500':'text-slate-400'}`}>{t.noResults}</p>
                        </td></tr>
                      ) : filtered.map((d,i) => {
                        const c = TYPE_COLORS[d.type]||TYPE_COLORS.accessory;
                        return (
                          <tr key={d.id} className={`border-t transition-colors ${rowHov}`}>
                            <td className={`px-4 py-3 font-mono text-xs ${dark?'text-slate-600':'text-slate-400'}`}>{String(i+1).padStart(2,'0')}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${dark?`${c.bg} ${c.text} ${c.border}`:'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5"><rect x="2" y="3" width="20" height="5" rx="1"/><path d="M12 8v8M8 16h8"/></svg>
                                </div>
                                <span className={`font-medium whitespace-nowrap ${dark?'text-slate-200':'text-slate-700'}`}>{d.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3"><TypeBadge type={d.type} t={t} dark={dark}/></td>
                            <td className="px-4 py-3"><StatusBadge status={d.status} t={t} dark={dark}/></td>
                            <td className={`px-4 py-3 font-mono text-xs tracking-wider whitespace-nowrap ${dark?'text-slate-400':'text-slate-500'}`}>{d.serial}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2.5 py-1 rounded-lg border ${LOC_COLORS[d.location]||'bg-slate-700 text-slate-400 border-slate-600'}`}>
                                {t.locations[d.location]||d.location}
                              </span>
                            </td>
                            <td className={`px-4 py-3 text-xs whitespace-nowrap ${dark?'text-slate-300':'text-slate-600'}`}>{d.employee||'—'}</td>
                            <td className={`px-4 py-3 text-xs whitespace-nowrap ${dark?'text-slate-500':'text-slate-400'}`}>
                              {d.addedAt?new Date(d.addedAt).toLocaleDateString(t.dir==='rtl'?'ar-SA':'en-US'):'—'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {d.online
                                ?<span className="inline-flex items-center gap-1.5 text-xs text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-ring"/>{t.online}</span>
                                :<span className={`inline-flex items-center gap-1.5 text-xs ${dark?'text-slate-500':'text-slate-400'}`}><span className={`w-1.5 h-1.5 rounded-full ${dark?'bg-slate-600':'bg-slate-300'}`}/>{t.offline}</span>
                              }
                            </td>
                            <td className={`px-4 py-3 text-xs max-w-[140px] ${dark?'text-slate-400':'text-slate-500'}`}>
                              {d.notes?<span className="block truncate" title={d.notes}>{d.notes}</span>:<span className={dark?'text-slate-600':'text-slate-300'}>—</span>}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {d.attachmentUrl
                                ?<a href={d.attachmentUrl} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:underline max-w-[100px]">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 shrink-0"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                                    <span className="truncate">{d.attachmentLabel||d.attachmentName||(t.dir==='rtl'?'ملف':'File')}</span>
                                  </a>
                                :<span className={`text-xs ${dark?'text-slate-600':'text-slate-300'}`}>—</span>
                              }
                            </td>
                            {perm.can('write') && (
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-center gap-1">
                                  <button onClick={() => { setEditDevice(d); setShowModal(true); }}
                                    className={`p-1.5 rounded-lg transition-all ${dark?'text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10':'text-slate-400 hover:text-cyan-500 hover:bg-cyan-50'}`}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                  </button>
                                  {perm.can('delete') && (
                                    <button onClick={() => handleDelete(d)}
                                      className={`p-1.5 rounded-lg transition-all ${dark?'text-slate-500 hover:text-red-400 hover:bg-red-500/10':'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}>
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
                                    </button>
                                  )}
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

          {/* ── FINANCE ── */}
          {activePage==='finance' && (
            !canAccessPage(user,'finance')
              ? <AccessDenied t={t} dark={dark} />
              : <div className="fade-up">
                  <h1 className={`text-2xl font-bold mb-6 ${dark?'text-white':'text-slate-800'}`}>{t.fin.title}</h1>
                  <FinanceModule t={t} dark={dark} user={user} />
                </div>
          )}
        </main>

        {/* ── Modals ── */}
        {showModal    && <DeviceModal t={t} device={editDevice} onSave={saveDevice} onClose={() => { setShowModal(false); setEditDevice(null); }} sheetsUrl={sheetsUrl}/>}
        {showUsers    && <UsersPanel t={t} onClose={() => setShowUsers(false)}/>}
        {showAudit    && <AuditLogPanel t={t} log={auditLog} onClose={() => setShowAudit(false)}/>}
        {showAccount  && <AccountSettings t={t} onClose={() => setShowAccount(false)}/>}
        {showSettings && (
          <SettingsPanel t={t} sheetsUrl={sheetsUrl}
            onSave={url => { setSheetsUrl(url); if(typeof window!=='undefined') localStorage.setItem('ne_sheets_url',url); }}
            onClose={() => setShowSettings(false)}/>
        )}
      </div>
    </>
  );
}
