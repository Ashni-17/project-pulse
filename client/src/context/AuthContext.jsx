import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, TOKEN_KEY } from '../lib/api.js';
import { disconnectSocket } from '../lib/socket.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(localStorage.getItem(TOKEN_KEY)));

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    api.get('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    disconnectSocket();
    setUser(null);
  }, []);

  useEffect(() => {
    window.addEventListener('pulse:unauthorized', logout);
    return () => window.removeEventListener('pulse:unauthorized', logout);
  }, [logout]);

  const value = useMemo(() => {
    const authenticate = async (path, body) => {
      const data = await api.post(path, body);
      localStorage.setItem(TOKEN_KEY, data.token);
      setUser(data.user);
    };
    return { user, loading, logout, login: (b) => authenticate('/auth/login', b), register: (b) => authenticate('/auth/register', b) };
  }, [user, loading, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
