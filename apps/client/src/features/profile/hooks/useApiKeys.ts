import { useState, useEffect } from "react";
import { toast } from "sonner";
import { fetchApiKeys, addApiKey, editApiKey, deleteApiKey } from "../services/apiKeys.service";
import { ApiKey } from "../types/apiKey.type";

const getErrorMessage = (err: unknown, fallback: string) => {
  if (err instanceof Error) return err.message;
  return fallback;
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
    } catch {
      toast.error("Nie udalo sie dodac klucza.");
    }
  };

  const handleEdit = async (id: string, payload: Partial<ApiKey>) => {
    try {
      await editApiKey(id, payload);
      await refresh();
      toast.success("Klucz zostal zaktualizowany!");
    } catch {
      toast.error("Nie udalo sie zaktualizowac klucza.");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteApiKey(id);
      await refresh();
      toast.success("Klucz zostal usuniety!");
    } catch {
      toast.error("Nie udalo sie usunac klucza.");
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
