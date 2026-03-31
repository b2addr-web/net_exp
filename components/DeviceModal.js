import { useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';

const BLANK = {
  name: '', type: '', status: '', serial: '',
  location: '', online: true,
  employee: '', empId: '',
  attachmentUrl: '', attachmentName: '',
};

// ── Editable combobox: type or pick from list ──────────────────────────────────
function ComboBox({ label, value, onChange, options, placeholder, inputCls, labelCls }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(value);
  const ref = useRef();

  useEffect(() => { setQ(value); }, [value]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(q.toLowerCase()) ||
    o.value.toLowerCase().includes(q.toLowerCase())
  );

  const pick = (opt) => {
    setQ(opt.label);
    onChange(opt.value);
    setOpen(false);
  };

  const handleChange = (e) => {
    setQ(e.target.value);
    onChange(e.target.value);
    setOpen(true);
  };

  return (
    <div ref={ref} className="relative">
      <label className={labelCls}>{label}</label>
      <input
        value={q}
        onChange={handleChange}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={inputCls}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-[#0f1929] border border-slate-700/60 rounded-xl shadow-2xl overflow-hidden max-h-44 overflow-y-auto">
          {filtered.map(o => (
            <button key={o.value} type="button" onMouseDown={() => pick(o)}
              className={`w-full text-start px-3 py-2 text-sm text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-400 transition-colors ${o.value === value ? 'bg-cyan-500/10 text-cyan-400' : ''}`}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── File Upload Zone ────────────────────────────────────────────────────────────
function FileUpload({ t, sheetsUrl, value, valueName, onChange, onNameChange }) {
  const [state, setState] = useState('idle'); // idle | uploading | done | error
  const [drag, setDrag] = useState(false);
  const inputRef = useRef();

  const uploadFile = async (file) => {
    if (!file) return;
    // If no Drive API configured, store as data URL locally
    setState('uploading');
    if (!sheetsUrl) {
      const reader = new FileReader();
      reader.onload = (e) => {
        onChange(e.target.result);
        onNameChange(file.name);
        setState('done');
      };
      reader.onerror = () => setState('error');
      reader.readAsDataURL(file);
      return;
    }
    // Upload via Apps Script to Google Drive
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async (e) => {
        const base64 = e.target.result.split(',')[1];
        const resp = await fetch(sheetsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'uploadFile',
            fileName: file.name,
            mimeType: file.type,
            data: base64,
          }),
        });
        const json = await resp.json();
        if (json.url) {
          onChange(json.url);
          onNameChange(file.name);
          setState('done');
        } else {
          setState('error');
        }
      };
    } catch {
      setState('error');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  const stateLabel = {
    idle: value ? t.modal.uploadDone : t.modal.attachmentHint,
    uploading: t.modal.uploading,
    done: t.modal.uploadDone,
    error: t.modal.uploadError,
  }[state];

  const stateColor = {
    idle: drag ? 'border-cyan-500/60 bg-cyan-500/5' : 'border-slate-600/50 hover:border-slate-500/70',
    uploading: 'border-amber-500/40 bg-amber-500/5',
    done: 'border-emerald-500/40 bg-emerald-500/5',
    error: 'border-red-500/40 bg-red-500/5',
  }[state];

  return (
    <div>
      <label className="block text-slate-400 text-xs font-medium mb-1.5">{t.modal.attachment}</label>
      <div
        className={`relative border border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${stateColor}`}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
        onClick={() => state !== 'uploading' && inputRef.current.click()}
      >
        <input ref={inputRef} type="file" accept="image/*,.pdf" className="hidden"
          onChange={e => { if (e.target.files[0]) uploadFile(e.target.files[0]); }} />

        {state === 'uploading' ? (
          <div className="flex items-center justify-center gap-2 text-amber-400 text-xs">
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/>
            </svg>
            {t.modal.uploading}
          </div>
        ) : (
          <div className={`flex flex-col items-center gap-1 text-xs ${state === 'done' ? 'text-emerald-400' : state === 'error' ? 'text-red-400' : 'text-slate-500'}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6 mb-1">
              {state === 'done'
                ? <path d="M20 7l-9 9-4-4"/>
                : <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>
              }
            </svg>
            <span>{stateLabel}</span>
            {valueName && <span className="text-slate-400 text-xs truncate max-w-[200px]">{valueName}</span>}
          </div>
        )}
      </div>
      {value && state === 'done' && (
        <a href={value} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-1.5 text-xs text-cyan-400 hover:underline">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          {t.modal.viewFile}
        </a>
      )}
    </div>
  );
}

// ─── Main Modal ────────────────────────────────────────────────────────────────
export default function DeviceModal({ t, device, onSave, onClose, sheetsUrl }) {
  const { user } = useAuth();
  const [form, setForm] = useState(BLANK);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(device ? { ...device } : { ...BLANK });
    setError('');
  }, [device]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const inputCls = 'w-full bg-slate-900/70 border border-slate-700/60 text-slate-100 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-cyan-500/60 transition-colors placeholder-slate-600';
  const labelCls = 'block text-slate-400 text-xs font-medium mb-1.5';

  const typeOpts = Object.entries(t.deviceTypes).map(([v, l]) => ({ value: v, label: l }));
  const statusOpts = Object.entries(t.statuses).map(([v, l]) => ({ value: v, label: l }));
  const locationOpts = Object.entries(t.locations).map(([v, l]) => ({ value: v, label: l }));

  const handleSave = () => {
    if (!form.name.trim() || !form.serial.trim()) {
      setError(t.modal.required);
      return;
    }
    const now = new Date().toISOString();
    const saved = {
      ...form,
      addedBy: device?.addedBy || user?.username || 'unknown',
      addedAt: device?.addedAt || now,
      updatedBy: user?.username || 'unknown',
      updatedByEmail: user?.email || '',
      updatedAt: now,
    };
    onSave(saved);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir={t.dir}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl glass bg-[#0a1220]/97 border border-slate-700/50 rounded-2xl shadow-2xl fade-up overflow-hidden max-h-[92vh] flex flex-col">
        <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-cyan-500 to-transparent shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0 border-b border-slate-700/40">
          <div>
            <h3 className="text-white font-semibold text-lg">{device ? t.modal.editTitle : t.modal.addTitle}</h3>
            {user && (
              <p className="text-slate-500 text-xs mt-0.5">
                {t.dir === 'rtl' ? `بواسطة: ${user.name || user.username}` : `By: ${user.name || user.username}`}
                {' · '}
                {new Date().toLocaleString(t.dir === 'rtl' ? 'ar-SA' : 'en-US')}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors p-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="overflow-y-auto p-6 space-y-4 flex-1">

          {/* Row 1: Device Name + Serial */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>{t.modal.name} <span className="text-red-400">*</span></label>
              <input value={form.name} onChange={e => set('name', e.target.value)}
                className={inputCls} placeholder="e.g. Cisco ISR 4331" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>{t.modal.serial} <span className="text-red-400">*</span></label>
              <input value={form.serial} onChange={e => set('serial', e.target.value)}
                className={inputCls} placeholder="SN-XXXXXXXX" />
            </div>
          </div>

          {/* Row 2: Type, Status, Location — editable comboboxes */}
          <div className="grid grid-cols-3 gap-4">
            <ComboBox
              label={t.modal.type} value={form.type}
              onChange={v => set('type', v)}
              options={typeOpts}
              placeholder={t.modal.typeHint}
              inputCls={inputCls} labelCls={labelCls}
            />
            <ComboBox
              label={t.modal.status} value={form.status}
              onChange={v => set('status', v)}
              options={statusOpts}
              placeholder={t.modal.typeHint}
              inputCls={inputCls} labelCls={labelCls}
            />
            <ComboBox
              label={t.modal.location} value={form.location}
              onChange={v => set('location', v)}
              options={locationOpts}
              placeholder={t.modal.typeHint}
              inputCls={inputCls} labelCls={labelCls}
            />
          </div>

          {/* Row 3: Employee + EmpID */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t.modal.employee}</label>
              <input value={form.employee} onChange={e => set('employee', e.target.value)}
                className={inputCls}
                placeholder={t.dir === 'rtl' ? 'مثال: أحمد العمري' : 'e.g. John Smith'} />
            </div>
            <div>
              <label className={labelCls}>{t.modal.empId}</label>
              <input value={form.empId} onChange={e => set('empId', e.target.value)}
                className={inputCls} placeholder="EMP-001" />
            </div>
          </div>

          {/* Row 4: Connection toggle */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-700/40">
            <button type="button" onClick={() => set('online', !form.online)}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${form.online ? 'bg-cyan-500' : 'bg-slate-600'}`}>
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${
                form.online
                  ? (t.dir === 'rtl' ? 'right-1' : 'left-6')
                  : (t.dir === 'rtl' ? 'right-6' : 'left-1')
              }`} />
            </button>
            <span className="text-slate-300 text-sm">{t.modal.connection}</span>
            <span className={`ms-auto text-xs px-2.5 py-1 rounded-lg ${form.online ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700/60 text-slate-500'}`}>
              {form.online ? t.online : t.offline}
            </span>
          </div>

          {/* Row 5: File Attachment */}
          <FileUpload
            t={t}
            sheetsUrl={sheetsUrl}
            value={form.attachmentUrl}
            valueName={form.attachmentName}
            onChange={url => set('attachmentUrl', url)}
            onNameChange={name => set('attachmentName', name)}
          />

          {/* Auto-recorded info */}
          <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/30 space-y-1">
            <p className="text-slate-500 text-xs font-medium mb-1.5">
              {t.dir === 'rtl' ? '⚡ يُسجَّل تلقائياً' : '⚡ Auto-recorded'}
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
              <span>{t.dir === 'rtl' ? 'المستخدم:' : 'User:'} <span className="text-slate-300">{user?.name || user?.username}</span></span>
              <span>{t.dir === 'rtl' ? 'الإيميل:' : 'Email:'} <span className="text-slate-300">{user?.email || '—'}</span></span>
              <span className="col-span-2">{t.dir === 'rtl' ? 'التاريخ والوقت:' : 'Date & Time:'} <span className="text-slate-300">{new Date().toLocaleString(t.dir === 'rtl' ? 'ar-SA' : 'en-US')}</span></span>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/25 text-red-400 text-xs rounded-lg px-3 py-2.5">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`flex gap-3 px-6 py-4 border-t border-slate-700/40 shrink-0 ${t.dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-slate-700/60 hover:bg-slate-600/70 text-slate-300 transition-colors">
            {t.modal.cancel}
          </button>
          <button onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-cyan-500 hover:bg-cyan-400 text-white transition-all shadow-lg shadow-cyan-500/20 active:scale-95">
            {t.modal.save}
          </button>
        </div>
      </div>
    </div>
  );
}
