import { useState, useEffect } from "react";
import { toast } from "sonner";
import { fetchApiKeys, addApiKey, editApiKey, deleteApiKey } from "../services/apiKeys.service";
import { ApiKey } from "../types/apiKey.type";
import { handleError } from "../../../lib/handleError";
import { useI18n } from "../../../i18n/I18nProvider";

const getErrorMessage = (err: unknown, fallback: string) => {
  const parsed = handleError(err);
  return parsed && parsed !== "Wystapil blad" ? parsed : fallback;
};

export function useApiKeys() {
  const { locale } = useI18n();
  const copy =
    locale === "pl"
      ? {
          fetchFallback: "Nie udalo sie pobrac kluczy API.",
          addSuccess: "Klucz zostal dodany!",
          addFailed: "Nie udalo sie dodac klucza.",
          addFailedDescription: "Blad zapisu klucza API.",
          editSuccess: "Klucz zostal zaktualizowany!",
          editFailed: "Nie udalo sie zaktualizowac klucza.",
          editFailedDescription: "Blad aktualizacji klucza API.",
          deleteSuccess: "Klucz zostal usuniety!",
          deleteFailed: "Nie udalo sie usunac klucza.",
          deleteFailedDescription: "Blad usuwania klucza API.",
        }
      : {
          fetchFallback: "Failed to fetch API keys.",
          addSuccess: "API key added.",
          addFailed: "Could not add API key.",
          addFailedDescription: "Failed to save API key.",
          editSuccess: "API key updated.",
          editFailed: "Could not update API key.",
          editFailedDescription: "Failed to update API key.",
          deleteSuccess: "API key deleted.",
          deleteFailed: "Could not delete API key.",
          deleteFailedDescription: "Failed to delete API key.",
        };

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await fetchApiKeys();
      setKeys(data);
      setError(null);
    } catch (err: unknown) {
      setError(getErrorMessage(err, copy.fetchFallback));
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleAdd = async (payload: Partial<ApiKey>) => {
    try {
      await addApiKey(payload);
      await refresh();
      toast.success(copy.addSuccess);
    } catch (err: unknown) {
      toast.error(copy.addFailed, { description: getErrorMessage(err, copy.addFailedDescription) });
    }
  };

  const handleEdit = async (id: string, payload: Partial<ApiKey>) => {
    try {
      await editApiKey(id, payload);
      await refresh();
      toast.success(copy.editSuccess);
    } catch (err: unknown) {
      toast.error(copy.editFailed, {
        description: getErrorMessage(err, copy.editFailedDescription),
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteApiKey(id);
      await refresh();
      toast.success(copy.deleteSuccess);
    } catch (err: unknown) {
      toast.error(copy.deleteFailed, {
        description: getErrorMessage(err, copy.deleteFailedDescription),
      });
    }
  };

  return {
    keys,
    loading,
    error,
    refresh,
    handleAdd,
    handleEdit,
    handleDelete,
  };
}
