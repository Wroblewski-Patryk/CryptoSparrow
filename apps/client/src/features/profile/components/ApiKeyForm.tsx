"use client";
import { useState } from "react";
import { toast } from "sonner";
import { ZodError } from "zod";
import { apiKeySchema } from "../types/apiKeyForm.type";

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
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<null | "ok" | "fail">(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setTimeout(() => {
      setTestResult(Math.random() > 0.5 ? "ok" : "fail");
      setTesting(false);
    }, 800);
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
          value={apiSecret}
          onChange={(e) => setApiSecret(e.target.value)}
          placeholder={isEdit ? "Podaj nowy API Secret (opcjonalnie)" : ""}
          required={!isEdit}
        />
      </div>
      <div className="flex items-center gap-4 mt-2">
        <button
          className={`btn btn-outline btn-info ${testing ? "loading" : ""}`}
          type="button"
          onClick={handleTest}
          disabled={testing}
        >
          Testuj polaczenie
        </button>
        {testResult === "ok" && <span className="text-success">OK</span>}
        {testResult === "fail" && <span className="text-error">Blad</span>}
      </div>
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
