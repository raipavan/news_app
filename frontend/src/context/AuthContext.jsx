import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearToken, getToken, hasStoredSession, setToken } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    try {
      if (getToken()) {
        const res = await api.get('/auth/me');
        setUser(res.user);
      } else if (hasStoredSession()) {
        const res = await api.refresh();
        setUser(res.user);
      } else {
        setUser(null);
      }
    } catch {
      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    const handleUnauthorized = () => {
      clearToken();
      setUser(null);
    };
    window.addEventListener('kv:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('kv:unauthorized', handleUnauthorized);
  }, []);

  const login = useCallback(async (identifier, password) => {
    const res = await api.post('/auth/login', { identifier, password }, { auth: false });
    setToken(res.accessToken);
    setUser(res.user);
    return res.user;
  }, []);

  const devLogin = useCallback(async (role) => {
    const res = await api.post('/auth/dev-login', { role }, { auth: false });
    setToken(res.accessToken);
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(async (data) => {
    const res = await api.post('/auth/register', data, { auth: false });
    setToken(res.accessToken);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', {}, { auth: false });
    } catch {
      /* session may already be gone */
    }
    clearToken();
    setUser(null);
  }, []);

  const hasRole = useCallback((role) => Boolean(user?.roles?.includes(role)), [user]);
  const hasPermission = useCallback(
    (permission) => Boolean(user?.permissions?.includes('*') || user?.permissions?.includes(permission)),
    [user]
  );
  const isStaff = Boolean(user?.roles?.includes('super_admin') || user?.roles?.includes('editor'));

  const value = useMemo(
    () => ({ user, loading, login, devLogin, register, logout, refreshUser: bootstrap, hasRole, hasPermission, isStaff }),
    [user, loading, login, devLogin, register, logout, bootstrap, hasRole, hasPermission, isStaff]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
