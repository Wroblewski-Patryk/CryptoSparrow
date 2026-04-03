import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import api from "../../../lib/api";
import { useI18n } from "../../../i18n/I18nProvider";
import { User } from "../types/user.type";

export function useUser() {
  const { locale } = useI18n();
  const copy =
    locale === "pl"
      ? {
          fetchFailed: "Nie udalo sie pobrac profilu uzytkownika",
          saveFailed: "Nie udalo sie zapisac profilu.",
        }
      : {
          fetchFailed: "Could not fetch user profile.",
          saveFailed: "Could not save profile.",
        };

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchUser = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<User>("/dashboard/profile/basic");
      setUser(res.data);
    } catch {
      toast.error(copy.fetchFailed);
    } finally {
      setLoading(false);
    }
  }, [copy.fetchFailed]);

  useEffect(() => {
    void fetchUser();
  }, [fetchUser]);

  const updateUser = async (data: Partial<User>) => {
    setLoading(true);
    try {
      const res = await api.patch<User>("/dashboard/profile/basic", data);
      setUser(res.data);
    } catch (err) {
      toast.error(copy.saveFailed);
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
