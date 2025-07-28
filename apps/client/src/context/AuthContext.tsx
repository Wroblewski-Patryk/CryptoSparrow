'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import api from '../lib/api';
import { toast } from 'sonner';

type User = { email: string; userId: string };

const AuthContext = createContext<{
  user: User | null;
  logout: () => void;
  loading: boolean;
  refetchUser: () => Promise<void>;
}>({
  user: null,
  logout: () => { },
  loading: true,
  refetchUser: async () => { },
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser();
  }, []);
  
  const fetchUser = async () => {
    try {
      const res = await api.get('/auth/me');
      const data = res.data;
      setUser({ email: data.email, userId: data.id });
    } catch {
      setUser(null);
      toast.warning("Sesja wygasła. Zaloguj się ponownie.");
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    toast.success("Wylogowano");

    await api.post('/auth/logout');
    setUser(null);
    window.location.href = '/auth/login';
  };

  return (
    <AuthContext.Provider value={{ user, logout, loading, refetchUser : fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
