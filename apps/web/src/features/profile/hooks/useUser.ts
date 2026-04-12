import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import api from "../../../lib/api";
import { useI18n } from "../../../i18n/I18nProvider";
import { User } from "../types/user.type";
import { executeWithRetry, isRetriableHttpError, runAsyncWithState } from "@/lib/async";

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
    try {
      await runAsyncWithState(setLoading, async () => {
        const res = await executeWithRetry(
          () => api.get<User>("/dashboard/profile/basic"),
          {
            maxAttempts: 2,
            retryDelayMs: 250,
            shouldRetry: isRetriableHttpError,
          }
        );
        setUser(res.data);
      });
    } catch {
      toast.error(copy.fetchFailed);
    }
  }, [copy.fetchFailed]);

  useEffect(() => {
    void fetchUser();
  }, [fetchUser]);

  const updateUser = async (data: Partial<User>) => {
    try {
      await runAsyncWithState(setLoading, async () => {
        const res = await executeWithRetry(
          () => api.patch<User>("/dashboard/profile/basic", data),
          {
            maxAttempts: 2,
            retryDelayMs: 250,
            shouldRetry: isRetriableHttpError,
          }
        );
        setUser(res.data);
      });
    } catch (err) {
      toast.error(copy.saveFailed);
      throw err;
    }
  };

  return {
    user,
    loading,
    fetchUser,
    updateUser,
  };
}
