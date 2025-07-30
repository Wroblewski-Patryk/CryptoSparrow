// /modules/profile/hooks/useProfile.ts
import { useEffect, useState } from "react";
import api from "../../../lib/api"; // Twój axios instance
import { toast } from "sonner";
import { User } from "../types/user.type"; // Typ użytkownika

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  // Pobierz profil przy starcie
  const fetchUser = async () => {
    setLoading(true);
    try {
      const res = await api.get<User>("/dashboard/profile/basic");
      setUser(res.data);
    } catch (err) {
      toast.error("Nie udało się pobrać profilu użytkownika");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUser();
    // eslint-disable-next-line
  }, []);

  // Update profilu
  const updateUser = async (data: Partial<User>) => {
    setLoading(true);
    try {
      const res = await api.patch<User>("/dashboard/profile/basic", data);
      setUser(res.data);
    } catch (err) {
      toast.error("Nie udało się zapisać profilu.");
      throw err;
    }
    setLoading(false);
  };

  return {
    user,
    loading,
    fetchUser,
    updateUser,
  };
}
