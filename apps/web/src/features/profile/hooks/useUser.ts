import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import api from "../../../lib/api";
import { User } from "../types/user.type";

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchUser = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<User>("/dashboard/profile/basic");
      setUser(res.data);
    } catch {
      toast.error("Nie udalo sie pobrac profilu uzytkownika");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUser();
  }, [fetchUser]);

  const updateUser = async (data: Partial<User>) => {
    setLoading(true);
    try {
      const res = await api.patch<User>("/dashboard/profile/basic", data);
      setUser(res.data);
    } catch (err) {
      toast.error("Nie udalo sie zapisac profilu.");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    user,
    loading,
    fetchUser,
    updateUser,
  };
}
