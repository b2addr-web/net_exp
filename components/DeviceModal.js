import { useState, useEffect } from 'react';
import { TYPE_COLORS } from '../lib/data';

const BLANK = { name: '', type: 'router', status: 'new', serial: '', location: 'main', online: true };

export default function DeviceModal({ t, device, onSave, onClose }) {
  const [form, setForm] = useState(BLANK);

  useEffect(() => {
    setForm(device ? { ...device } : BLANK);
  }, [device]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const inputCls = 'w-full bg-slate-900/70 border border-slate-700/60 text-slate-100 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-cyan-500/60 transition-colors';
  const labelCls = 'block text-slate-400 text-xs font-medium mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir={t.dir}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg glass bg-[#0f1929]/95 border border-slate-700/50 rounded-2xl shadow-2xl fade-up overflow-hidden">
        {/* Header accent */}
        <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-white font-semibold text-lg">
              {device ? t.modal.editTitle : t.modal.addTitle}
            </h3>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>{t.modal.name}</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} className={inputCls}
                placeholder={t.dir === 'rtl' ? 'مثال: Cisco ISR 4331' : 'e.g. Cisco ISR 4331'} />
            </div>
            <div>
              <label className={labelCls}>{t.modal.serial}</label>
              <input value={form.serial} onChange={e => set('serial', e.target.value)} className={inputCls}
                placeholder="SN123456" />
            </div>
            <div>
              <label className={labelCls}>{t.modal.type}</label>
              <select value={form.type} onChange={e => set('type', e.target.value)} className={inputCls}>
                {Object.entries(t.deviceTypes).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>{t.modal.status}</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls}>
                {Object.entries(t.statuses).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>{t.modal.location}</label>
              <select value={form.location} onChange={e => set('location', e.target.value)} className={inputCls}>
                {Object.entries(t.locations).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-700/40">
                <button type="button" onClick={() => set('online', !form.online)}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${form.online ? 'bg-cyan-500' : 'bg-slate-600'}`}>
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${
                    form.online
                      ? (t.dir === 'rtl' ? 'right-1' : 'left-6')
                      : (t.dir === 'rtl' ? 'right-6' : 'left-1')
                  }`} />
                </button>
                <span className="text-slate-300 text-sm">{t.modal.connection}</span>
                <span className={`ms-auto text-xs px-2 py-0.5 rounded-lg ${form.online ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700 text-slate-500'}`}>
                  {form.online ? t.online : t.offline}
                </span>
              </div>
            </div>
          </div>

          <div className={`flex gap-3 mt-6 ${t.dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-slate-700/60 hover:bg-slate-600/70 text-slate-300 transition-colors">
              {t.modal.cancel}
            </button>
            <button onClick={() => { if (form.name && form.serial) { onSave(form); onClose(); } }}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-cyan-500 hover:bg-cyan-400 text-white transition-all shadow-lg shadow-cyan-500/20 active:scale-95">
              {t.modal.save}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
