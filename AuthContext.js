import { createContext, useContext, useState, useEffect } from 'react';
import { loginUser, getUsers, addUser as dbAddUser, removeUser as dbRemoveUser, saveSession, loadSession, clearSession } from '../lib/db';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,  setUser]  = useState(null);
  const [users, setUsers] = useState([]);
  const [ready, setReady] = useState(false);

  // تحميل الجلسة والمستخدمين عند البدء
  useEffect(() => {
    const init = async () => {
      try {
        const session = loadSession();
        if (session) setUser(session);
        const list = await getUsers();
        setUsers(list);
      } catch (e) {
        console.error('Auth init error:', e);
      }
      setReady(true);
    };
    init();
  }, []);

  const login = async (username, password) => {
    try {
      const found = await loginUser(username, password);
      if (!found) return false;
      const safe = {
        id:       found.id,
        username: found.username,
        name:     found.name,
        role:     found.role,
        email:    found.email || '',
      };
      setUser(safe);
      saveSession(safe);
      return true;
    } catch {
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    clearSession();
  };

  const addUser = async (u) => {
    const created = await dbAddUser(u);
    setUsers(prev => [...prev, created]);
  };

  const removeUser = async (id) => {
    await dbRemoveUser(id);
    setUsers(prev => prev.filter(u => u.id !== id));
  };

  const refreshUsers = async () => {
    const list = await getUsers();
    setUsers(list);
  };

  return (
    <AuthContext.Provider value={{ user, users, login, logout, addUser, removeUser, refreshUsers, ready }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
