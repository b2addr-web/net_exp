import { createContext, useContext, useState, useEffect } from 'react';
import { INITIAL_USERS } from '../lib/data';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]   = useState(null);
  const [users, setUsers] = useState(INITIAL_USERS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      // إذا تغيرت بيانات المستخدمين الافتراضية، امسح المحفوظ القديم
      const VERSION = 'v3'; // غيّر هذا الرقم عند أي تعديل على بيانات الدخول
      const savedVersion = localStorage.getItem('ne_version');
      if (savedVersion !== VERSION) {
        localStorage.removeItem('ne_users');
        localStorage.removeItem('ne_user');
        localStorage.setItem('ne_version', VERSION);
      }

      const saved = localStorage.getItem('ne_user');
      const savedUsers = localStorage.getItem('ne_users');
      if (savedUsers) setUsers(JSON.parse(savedUsers));
      if (saved) setUser(JSON.parse(saved));
    } catch {
      localStorage.clear();
    }
    setReady(true);
  }, []);

  const login = (username, password) => {
    const found = users.find(u => u.username === username && u.password === password);
    if (!found) return false;
    const safe = { id: found.id, username: found.username, name: found.name, role: found.role, email: found.email || '' };
    setUser(safe);
    localStorage.setItem('ne_user', JSON.stringify(safe));
    return true;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('ne_user');
  };

  const addUser = (u) => {
    const next = [...users, { ...u, id: Date.now() }];
    setUsers(next);
    localStorage.setItem('ne_users', JSON.stringify(next));
  };

  const removeUser = (id) => {
    const next = users.filter(u => u.id !== id);
    setUsers(next);
    localStorage.setItem('ne_users', JSON.stringify(next));
  };

  return (
    <AuthContext.Provider value={{ user, users, login, logout, addUser, removeUser, ready }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
