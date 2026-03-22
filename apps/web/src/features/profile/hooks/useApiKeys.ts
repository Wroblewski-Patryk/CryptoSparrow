import { useState, useEffect } from "react";
import { toast } from "sonner";
import { fetchApiKeys, addApiKey, editApiKey, deleteApiKey } from "../services/apiKeys.service";
import { ApiKey } from "../types/apiKey.type";
import { handleError } from "../../../lib/handleError";

const getErrorMessage = (err: unknown, fallback: string) => {
  const parsed = handleError(err);
  return parsed && parsed !== "Wystapil blad" ? parsed : fallback;
};

export function useApiKeys() {
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
      setError(getErrorMessage(err, "Failed to fetch API keys"));
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
      toast.success("Klucz zostal dodany!");
    } catch (err: unknown) {
      toast.error("Nie udalo sie dodac klucza.", { description: getErrorMessage(err, "Blad zapisu klucza API.") });
    }
  };

  const handleEdit = async (id: string, payload: Partial<ApiKey>) => {
    try {
      await editApiKey(id, payload);
      await refresh();
      toast.success("Klucz zostal zaktualizowany!");
    } catch (err: unknown) {
      toast.error("Nie udalo sie zaktualizowac klucza.", {
        description: getErrorMessage(err, "Blad aktualizacji klucza API."),
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteApiKey(id);
      await refresh();
      toast.success("Klucz zostal usuniety!");
    } catch (err: unknown) {
      toast.error("Nie udalo sie usunac klucza.", {
        description: getErrorMessage(err, "Blad usuwania klucza API."),
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
