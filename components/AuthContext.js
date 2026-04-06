import { createContext, useContext, useState, useEffect } from 'react';

// ══════════════════════════════════════════════════════
// بيانات الدخول الثابتة — لا تعتمد على أي قاعدة بيانات
// ══════════════════════════════════════════════════════
const MASTER_USERS = [
  { id:1, username:'Badr',    password:'BADR050982538', role:'admin',  name:'Badr',         email:'admin@netexpert.com' },
  { id:2, username:'viewer1', password:'view123',       role:'viewer', name:'موظف التقنية', email:'it@netexpert.com'    },
];

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,   setUser]   = useState(null);
  const [extras, setExtras] = useState([]);
  const [ready,  setReady]  = useState(false);

  useEffect(() => {
    try {
      const s = localStorage.getItem('ne_sess');
      if (s) setUser(JSON.parse(s));
      const e = localStorage.getItem('ne_extras');
      if (e) setExtras(JSON.parse(e));
    } catch {}
    setReady(true);
  }, []);

  const users = [...MASTER_USERS, ...extras];

  const login = (username, password) => {
    const found = users.find(
      u => u.username.trim() === username.trim() && u.password === password
    );
    if (!found) return false;
    const safe = { id:found.id, username:found.username, name:found.name, role:found.role, email:found.email||'' };
    setUser(safe);
    try { localStorage.setItem('ne_sess', JSON.stringify(safe)); } catch {}
    return true;
  };

  const logout = () => {
    setUser(null);
    try { localStorage.removeItem('ne_sess'); } catch {}
  };

  const addUser = (u) => {
    const next = [...extras, { ...u, id: Date.now() }];
    setExtras(next);
    try { localStorage.setItem('ne_extras', JSON.stringify(next)); } catch {}
  };

  const removeUser = (id) => {
    if (MASTER_USERS.find(u => u.id === id)) return;
    const next = extras.filter(u => u.id !== id);
    setExtras(next);
    try { localStorage.setItem('ne_extras', JSON.stringify(next)); } catch {}
  };

  const updatePassword = (id, newPass) => {
    const next = extras.map(u => u.id === id ? { ...u, password: newPass } : u);
    setExtras(next);
    try { localStorage.setItem('ne_extras', JSON.stringify(next)); } catch {}
  };

  return (
    <AuthContext.Provider value={{ user, users, login, logout, addUser, removeUser, updatePassword, ready }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
