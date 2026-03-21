"use client";
import { useState } from "react";
import { toast } from "sonner";
import { ZodError } from "zod";
import { isAxiosError } from "axios";
import { apiKeySchema } from "../types/apiKeyForm.type";
import { testApiKeyConnection } from "../services/apiKeys.service";

const EXCHANGES = ["BINANCE"];

export type ApiKeyFormSavePayload = {
  label: string;
  exchange: string;
  apiKey?: string;
  apiSecret?: string;
};

export type ApiKeyFormProps = {
  defaultValues?: {
    label: string;
    exchange: string;
  };
  isEdit?: boolean;
  onSave: (data: ApiKeyFormSavePayload) => void;
  onCancel: () => void;
};

export default function ApiKeyForm({ defaultValues, isEdit, onSave, onCancel }: ApiKeyFormProps) {
  const [label, setLabel] = useState(defaultValues?.label || "");
  const [exchange, setExchange] = useState(defaultValues?.exchange || EXCHANGES[0]);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [testStatus, setTestStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState<string | null>(null);

  const handleTest = async () => {
    if (!apiKey || !apiSecret) {
      setTestStatus("error");
      setTestMessage("Uzupelnij API Key i API Secret przed testem.");
      return;
    }

    setTestStatus("loading");
    setTestMessage(null);

    try {
      const result = await testApiKeyConnection({ exchange, apiKey, apiSecret });
      if (result.ok) {
        setTestStatus("success");
        setTestMessage(result.message ?? "Polaczenie dziala poprawnie.");
        return;
      }

      setTestStatus("error");
      setTestMessage(result.message ?? "Nie udalo sie zweryfikowac polaczenia.");
    } catch (err: unknown) {
      const message = isAxiosError<{ message?: string }>(err)
        ? (err.response?.data?.message ?? "Nie udalo sie zweryfikowac polaczenia.")
        : "Nie udalo sie zweryfikowac polaczenia.";
      setTestStatus("error");
      setTestMessage(message);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEdit) {
        apiKeySchema.pick({ label: true, exchange: true }).parse({ label, exchange });
      } else {
        apiKeySchema.parse({ label, exchange, apiKey, apiSecret });
      }

      const payload: ApiKeyFormSavePayload = { label, exchange };
      if (apiKey) payload.apiKey = apiKey;
      if (apiSecret) payload.apiSecret = apiSecret;
      onSave(payload);
    } catch (err: unknown) {
      if (err instanceof ZodError) {
        toast.error(err.issues[0]?.message || "Validation error");
        return;
      }
      toast.error("Validation error");
    }
  };

  return (
    <form className="space-y-4 w-full" onSubmit={handleSubmit}>
      <div className="form-control w-full">
        <label className="label pl-0">
          <span className="label-text text-left w-full">Nazwa klucza</span>
        </label>
        <input
          className="input input-bordered w-full"
          type="text"
          aria-label="Nazwa klucza"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          required
        />
      </div>
      <div className="form-control w-full">
        <label className="label pl-0">
          <span className="label-text text-left w-full">Gielda</span>
        </label>
        <select
          className="select select-bordered w-full"
          aria-label="Gielda"
          value={exchange}
          onChange={(e) => setExchange(e.target.value)}
        >
          {EXCHANGES.map((ex) => (
            <option key={ex} value={ex}>
              {ex}
            </option>
          ))}
        </select>
      </div>
      <div className="form-control w-full">
        <label className="label pl-0">
          <span className="label-text text-left w-full">API Key</span>
        </label>
        <input
          className="input input-bordered w-full font-mono"
          type="text"
          aria-label="API Key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={isEdit ? "Podaj nowy API Key (opcjonalnie)" : ""}
          required={!isEdit}
        />
      </div>
      <div className="form-control w-full">
        <label className="label pl-0">
          <span className="label-text text-left w-full">API Secret</span>
        </label>
        <input
          className="input input-bordered w-full font-mono"
          type="password"
          aria-label="API Secret"
          value={apiSecret}
          onChange={(e) => setApiSecret(e.target.value)}
          placeholder={isEdit ? "Podaj nowy API Secret (opcjonalnie)" : ""}
          required={!isEdit}
        />
      </div>
      <div className="flex items-center gap-4 mt-2">
        <button
          className={`btn btn-outline btn-info ${testStatus === "loading" ? "loading" : ""}`}
          type="button"
          onClick={handleTest}
          disabled={testStatus === "loading"}
        >
          {testStatus === "loading" ? "Testowanie..." : "Testuj polaczenie"}
        </button>
        {testStatus === "success" && <span className="text-success">OK</span>}
        {testStatus === "error" && <span className="text-error">Blad</span>}
      </div>
      {testMessage && (
        <p className={`text-sm ${testStatus === "error" ? "text-error" : "text-success"}`}>{testMessage}</p>
      )}
      <div className="flex gap-2 mt-4">
        <button className="btn btn-primary" type="submit">
          Zapisz
        </button>
        <button className="btn btn-outline" type="button" onClick={onCancel}>
          Anuluj
        </button>
      </div>
    </form>
  );
}
