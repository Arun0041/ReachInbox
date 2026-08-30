import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authApi } from '../api/auth';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = 'outbox_token';

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async (): Promise<void> => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setUser(await authApi.me());
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const result = await authApi.login({ email, password });
    localStorage.setItem(TOKEN_KEY, result.token);
    setUser(result.user);
    return result.user;
  };

  const register = async (name: string, email: string, password: string): Promise<User> => {
    const result = await authApi.register({ name, email, password });
    localStorage.setItem(TOKEN_KEY, result.token);
    setUser(result.user);
    return result.user;
  };

  const logout = (): void => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, register, logout, refresh }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}