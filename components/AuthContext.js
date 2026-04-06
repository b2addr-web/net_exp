import { createContext, useContext, useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// ── Supabase client ───────────────────────────────────────────────────────────
const sb = createClient(
  'https://rzgeuvizdfsmsuppidre.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6Z2V1dml6ZGZzbXN1cHBpZHJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNzg4NTksImV4cCI6MjA5MDk1NDg1OX0.lVyOep2JgRsiZGj1wtByBHVhF40KJgseYAu3lguEUe8'
);

// ── المستخدمون الافتراضيون — fallback إذا فشل Supabase ──────────────────────
const DEFAULT_USERS = [
  { id:1, username:'Badr',    password:'BADR050982538', role:'admin',  name:'Badr',         email:'admin@netexpert.com' },
  { id:2, username:'viewer1', password:'view123',       role:'viewer', name:'موظف التقنية', email:'it@netexpert.com'    },
];

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,  setUser]  = useState(null);
  const [users, setUsers] = useState(DEFAULT_USERS);
  const [ready, setReady] = useState(false);

  // ── تحميل المستخدمين من Supabase ─────────────────────────────────────────
  const fetchUsers = async () => {
    try {
      const { data, error } = await sb.from('app_users').select('*');
      if (!error && data && data.length > 0) {
        setUsers(data);
        return data;
      }
    } catch {}
    return DEFAULT_USERS;
  };

  useEffect(() => {
    const init = async () => {
      // استعادة الجلسة
      try {
        const s = localStorage.getItem('ne_sess');
        if (s) setUser(JSON.parse(s));
      } catch {}
      // تحميل المستخدمين
      await fetchUsers();
      setReady(true);
    };
    init();
  }, []);

  // ── تسجيل الدخول ─────────────────────────────────────────────────────────
  const login = async (username, password) => {
    // أولاً من Supabase
    try {
      const { data, error } = await sb
        .from('app_users')
        .select('*')
        .eq('username', username.trim())
        .eq('password', password)
        .single();
      if (!error && data) {
        const safe = { id:data.id, username:data.username, name:data.name, role:data.role, email:data.email||'' };
        setUser(safe);
        try { localStorage.setItem('ne_sess', JSON.stringify(safe)); } catch {}
        return true;
      }
    } catch {}

    // Fallback: من الكود المدمج
    const found = DEFAULT_USERS.find(
      u => u.username.trim() === username.trim() && u.password === password
    );
    if (found) {
      const safe = { id:found.id, username:found.username, name:found.name, role:found.role, email:found.email||'' };
      setUser(safe);
      try { localStorage.setItem('ne_sess', JSON.stringify(safe)); } catch {}
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    try { localStorage.removeItem('ne_sess'); } catch {}
  };

  // ── إضافة مستخدم ─────────────────────────────────────────────────────────
  const addUser = async (u) => {
    try {
      const { data, error } = await sb
        .from('app_users')
        .insert([{ username:u.username, password:u.password, name:u.name||u.username, role:u.role||'viewer', email:u.email||'' }])
        .select()
        .single();
      if (!error && data) {
        setUsers(prev => [...prev, data]);
        return data;
      }
    } catch {}
    // Fallback محلي
    const newU = { ...u, id: Date.now() };
    setUsers(prev => [...prev, newU]);
    return newU;
  };

  // ── حذف مستخدم ───────────────────────────────────────────────────────────
  const removeUser = async (id) => {
    if (DEFAULT_USERS.find(u => u.id === id)) return; // لا تحذف الأساسيين
    try {
      await sb.from('app_users').delete().eq('id', id);
    } catch {}
    setUsers(prev => prev.filter(u => u.id !== id));
  };

  // ── تغيير كلمة المرور ────────────────────────────────────────────────────
  const updatePassword = async (id, newPass) => {
    try {
      await sb.from('app_users').update({ password: newPass }).eq('id', id);
    } catch {}
    setUsers(prev => prev.map(u => u.id === id ? { ...u, password: newPass } : u));
  };

  return (
    <AuthContext.Provider value={{ user, users, login, logout, addUser, removeUser, updatePassword, fetchUsers, ready }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
