"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api from "../lib/api";
import { toast } from "sonner";

type User = { email: string; userId: string };

type FetchUserOptions = {
  notifyOnUnauthorized?: boolean;
};

const AuthContext = createContext<{
  user: User | null;
  logout: () => void;
  loading: boolean;
  refetchUser: () => Promise<void>;
}>({
  user: null,
  logout: () => {},
  loading: true,
  refetchUser: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async (options: FetchUserOptions = {}) => {
    const { notifyOnUnauthorized = true } = options;

    try {
      const res = await api.get("/auth/me");
      const data = res.data;
      setUser({ email: data.email, userId: data.id });
    } catch (error) {
      setUser(null);

      const status =
        typeof error === "object" && error !== null && "response" in error
          ? (error as { response?: { status?: number } }).response?.status
          : undefined;

      const onProtectedRoute =
        typeof window !== "undefined" &&
        (window.location.pathname.startsWith("/dashboard") || window.location.pathname.startsWith("/admin"));

      if (notifyOnUnauthorized && status === 401 && onProtectedRoute) {
        toast.warning("Sesja wygasla. Zaloguj sie ponownie.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUser({ notifyOnUnauthorized: false });
  }, [fetchUser]);

  const logout = async () => {
    toast.success("Wylogowano");

    await api.post("/auth/logout");
    setUser(null);
    window.location.href = "/auth/login";
  };

  return (
    <AuthContext.Provider
      value={{ user, logout, loading, refetchUser: () => fetchUser({ notifyOnUnauthorized: true }) }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
