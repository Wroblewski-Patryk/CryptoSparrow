// /modules/profile/components/ApiKeyForm.tsx
"use client";
import { useState } from "react";
import { toast } from "sonner";
import { apiKeySchema } from "../types/apiKeyForm.type";

const EXCHANGES = ["BINANCE"];

export type ApiKeyFormProps = {
  defaultValues?: {
    label: string;
    exchange: string;
  };
  isEdit?: boolean;
  onSave: (data: { label: string; exchange: string; apiKey?: string; apiSecret?: string }) => void;
  onCancel: () => void;
};

export default function ApiKeyForm({ defaultValues, isEdit, onSave, onCancel }: ApiKeyFormProps) {
  const [label, setLabel] = useState(defaultValues?.label || "");
  const [exchange, setExchange] = useState(defaultValues?.exchange || EXCHANGES[0]);
  // inputy na key/secret ZAWSZE puste przy edycji
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<null | "ok" | "fail">(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    // TODO: call backend do testu klucza
    setTimeout(() => {
      setTestResult(Math.random() > 0.5 ? "ok" : "fail");
      setTesting(false);
    }, 800);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Przy dodawaniu wszystko wymagane, przy edycji tylko label/exchange wymagane
      if (isEdit) {
        apiKeySchema.pick({ label: true, exchange: true }).parse({ label, exchange });
      } else {
        apiKeySchema.parse({ label, exchange, apiKey, apiSecret });
      }
      const payload: any = { label, exchange };
      if (apiKey) payload.apiKey = apiKey;
      if (apiSecret) payload.apiSecret = apiSecret;
      onSave(payload);
    } catch (e: any) {
      toast.error(e.errors?.[0]?.message || "Błąd walidacji");
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
          <span className="label-text text-left w-full">Giełda</span>
        </label>
        <select
          className="select select-bordered w-full"
          value={exchange}
          onChange={(e) => setExchange(e.target.value)}
        >
          {EXCHANGES.map((ex) => (
            <option key={ex} value={ex}>{ex}</option>
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
          Testuj połączenie
        </button>
        {testResult === "ok" && <span className="text-success">OK</span>}
        {testResult === "fail" && <span className="text-error">Błąd</span>}
      </div>
      <div className="flex gap-2 mt-4">
        <button className="btn btn-primary" type="submit">Zapisz</button>
        <button className="btn btn-outline" type="button" onClick={onCancel}>Anuluj</button>
      </div>
    </form>
  );
}
