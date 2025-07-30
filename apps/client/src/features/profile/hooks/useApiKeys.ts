import { useState, useEffect } from "react";
import {
  fetchApiKeys,
  addApiKey,
  editApiKey,
  deleteApiKey,
} from "../services/apiKeys.service";
import { ApiKey } from "../types/apiKey.type";
import { toast } from "sonner"; 

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
    } catch (err: any) {
      setError(err.message || "Błąd pobierania kluczy");
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleAdd = async (payload: Partial<ApiKey>) => {
    try{
      await addApiKey(payload);
      await refresh();
      toast.success("Klucz został dodany!");
    } catch (err: any) {
      toast.error("Nie udało się dodać klucza.");
    }
  };

  const handleEdit = async (id: string, payload: Partial<ApiKey>) => {
    try {
      await editApiKey(id, payload);
      await refresh();
      toast.success("Klucz został zaktualizowany!");
    } catch (err: any) {
      toast.error("Nie udało się zaktualizować klucza.");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteApiKey(id);
      await refresh();
      toast.success("Klucz został usunięty!");
    } catch (err: any) {
      toast.error("Nie udało się usunąć klucza.");
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
