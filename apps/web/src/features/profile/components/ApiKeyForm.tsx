"use client";
import { useState } from "react";
import { toast } from "sonner";
import { ZodError } from "zod";
import { isAxiosError } from "axios";
import { apiKeySchema } from "../types/apiKeyForm.type";
import { testApiKeyConnection } from "../services/apiKeys.service";
import { useI18n } from "../../../i18n/I18nProvider";
import {
  EXCHANGE_OPTIONS,
  ExchangeOption,
  supportsExchangeCapability,
} from "@/features/exchanges/exchangeCapabilities";

const EXCHANGES: ExchangeOption[] = [...EXCHANGE_OPTIONS];

export type ApiKeyFormSavePayload = {
  label: string;
  exchange: ExchangeOption;
  apiKey?: string;
  apiSecret?: string;
  syncExternalPositions: boolean;
  manageExternalPositions: boolean;
};

export type ApiKeyFormProps = {
  defaultValues?: {
    label: string;
    exchange: ExchangeOption;
    syncExternalPositions: boolean;
    manageExternalPositions: boolean;
  };
  isEdit?: boolean;
  onSave: (data: ApiKeyFormSavePayload) => void;
  onCancel: () => void;
};

export default function ApiKeyForm({ defaultValues, isEdit, onSave, onCancel }: ApiKeyFormProps) {
  const { locale } = useI18n();
  const copy =
    locale === "pl"
      ? {
          fillCredentialsBeforeTest: "Uzupelnij API Key i API Secret przed testem.",
          testConnectionOk: "Polaczenie dziala poprawnie.",
          testConnectionFailed: "Nie udalo sie zweryfikowac polaczenia.",
          provideBothKeys: "Podaj API Key i API Secret, aby zaktualizowac polaczenie.",
          testBeforeSave: "Przetestuj polaczenie i uzyskaj status OK przed zapisem.",
          validationError: "Blad walidacji",
          keyName: "Nazwa klucza",
          exchange: "Gielda",
          apiKey: "API Key",
          apiSecret: "API Secret",
          apiKeyPlaceholder: "Podaj nowy API Key (opcjonalnie)",
          apiSecretPlaceholder: "Podaj nowy API Secret (opcjonalnie)",
          syncExternal: "Synchronizuj zewnetrzne pozycje z gieldy",
          manageExternal: "Zarzadzaj zewnetrznymi pozycjami przez bota",
          testing: "Testowanie...",
          testConnection: "Testuj polaczenie",
          ok: "OK",
          error: "Blad",
          save: "Zapisz",
          cancel: "Anuluj",
          placeholderProbeInfo:
            "Dla tej gieldy test API key nie jest jeszcze dostepny (placeholder adapter). Zapis jest dozwolony.",
        }
      : {
          fillCredentialsBeforeTest: "Fill in API Key and API Secret before testing.",
          testConnectionOk: "Connection verified successfully.",
          testConnectionFailed: "Could not verify connection.",
          provideBothKeys: "Provide both API Key and API Secret to update connection.",
          testBeforeSave: "Run connection test and get OK status before saving.",
          validationError: "Validation error",
          keyName: "Key name",
          exchange: "Exchange",
          apiKey: "API Key",
          apiSecret: "API Secret",
          apiKeyPlaceholder: "Provide new API Key (optional)",
          apiSecretPlaceholder: "Provide new API Secret (optional)",
          syncExternal: "Sync external exchange positions",
          manageExternal: "Allow bot to manage external positions",
          testing: "Testing...",
          testConnection: "Test connection",
          ok: "OK",
          error: "Error",
          save: "Save",
          cancel: "Cancel",
          placeholderProbeInfo:
            "API key test is not available for this exchange yet (placeholder adapter). Saving is still allowed.",
        };

  const [label, setLabel] = useState(defaultValues?.label || "");
  const [exchange, setExchange] = useState<ExchangeOption>(
    defaultValues?.exchange || EXCHANGES[0]
  );
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [syncExternalPositions, setSyncExternalPositions] = useState(defaultValues?.syncExternalPositions ?? true);
  const [manageExternalPositions, setManageExternalPositions] = useState(defaultValues?.manageExternalPositions ?? false);
  const [testStatus, setTestStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testedFingerprint, setTestedFingerprint] = useState<string | null>(null);

  const currentFingerprint = `${exchange}::${apiKey}::${apiSecret}`;

  const exchangeSupportsProbe = supportsExchangeCapability(exchange, "API_KEY_PROBE");
  const requiresConnectionTest = (!isEdit || Boolean(apiKey) || Boolean(apiSecret)) && exchangeSupportsProbe;

  const handleTest = async () => {
    if (!exchangeSupportsProbe) {
      setTestStatus("idle");
      setTestMessage(copy.placeholderProbeInfo);
      setTestedFingerprint(null);
      return;
    }

    if (!apiKey || !apiSecret) {
      setTestStatus("error");
      setTestMessage(copy.fillCredentialsBeforeTest);
      setTestedFingerprint(null);
      return;
    }

    setTestStatus("loading");
    setTestMessage(null);

    try {
      const result = await testApiKeyConnection({ exchange, apiKey, apiSecret });
      if (result.ok) {
        setTestStatus("success");
        setTestMessage(result.message ?? copy.testConnectionOk);
        setTestedFingerprint(currentFingerprint);
        return;
      }

      setTestStatus("error");
      setTestMessage(result.message ?? copy.testConnectionFailed);
      setTestedFingerprint(null);
    } catch (err: unknown) {
      const message = isAxiosError<{ message?: string }>(err)
        ? (err.response?.data?.message ?? copy.testConnectionFailed)
        : copy.testConnectionFailed;
      setTestStatus("error");
      setTestMessage(message);
      setTestedFingerprint(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEdit) {
        apiKeySchema.pick({ label: true, exchange: true }).parse({ label, exchange });
        if ((apiKey && !apiSecret) || (!apiKey && apiSecret)) {
          toast.error(copy.provideBothKeys);
          return;
        }
      } else {
        apiKeySchema.parse({ label, exchange, apiKey, apiSecret });
      }

      if (requiresConnectionTest) {
        const hasMatchingSuccess = testStatus === "success" && testedFingerprint === currentFingerprint;
        if (!hasMatchingSuccess) {
          toast.error(copy.testBeforeSave);
          return;
        }
      }

      const payload: ApiKeyFormSavePayload = { label, exchange, syncExternalPositions, manageExternalPositions };
      if (apiKey) payload.apiKey = apiKey;
      if (apiSecret) payload.apiSecret = apiSecret;
      onSave(payload);
    } catch (err: unknown) {
      if (err instanceof ZodError) {
        toast.error(err.issues[0]?.message || copy.validationError);
        return;
      }
      toast.error(copy.validationError);
    }
  };

  return (
    <form className="space-y-4 w-full" onSubmit={handleSubmit}>
      <div className="form-control w-full">
        <label className="label pl-0">
          <span className="label-text text-left w-full">{copy.keyName}</span>
        </label>
        <input
          className="input input-bordered w-full"
          type="text"
          aria-label={copy.keyName}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          required
        />
      </div>
      <div className="form-control w-full">
        <label className="label pl-0">
          <span className="label-text text-left w-full">{copy.exchange}</span>
        </label>
        <select
          className="select select-bordered w-full"
          aria-label={copy.exchange}
          value={exchange}
          onChange={(e) => setExchange((e.target.value as ExchangeOption) || "BINANCE")}
        >
          {EXCHANGES.map((ex) => (
            <option key={ex} value={ex}>
              {ex}
            </option>
          ))}
        </select>
      </div>
      {!exchangeSupportsProbe ? (
        <div className="alert alert-info text-sm">
          <div className="space-y-1">
            <span className="badge badge-xs badge-warning badge-outline">PLACEHOLDER</span>
            <span>{copy.placeholderProbeInfo}</span>
          </div>
        </div>
      ) : null}
      <div className="form-control w-full">
        <label className="label pl-0">
          <span className="label-text text-left w-full">{copy.apiKey}</span>
        </label>
        <input
          className="input input-bordered w-full font-mono"
          type="text"
          aria-label={copy.apiKey}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={isEdit ? copy.apiKeyPlaceholder : ""}
          required={!isEdit}
        />
      </div>
      <div className="form-control w-full">
        <label className="label pl-0">
          <span className="label-text text-left w-full">{copy.apiSecret}</span>
        </label>
        <input
          className="input input-bordered w-full font-mono"
          type="password"
          aria-label={copy.apiSecret}
          value={apiSecret}
          onChange={(e) => setApiSecret(e.target.value)}
          placeholder={isEdit ? copy.apiSecretPlaceholder : ""}
          required={!isEdit}
        />
      </div>
      <div className="form-control">
        <label className="label cursor-pointer justify-start gap-3">
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={syncExternalPositions}
            onChange={(e) => setSyncExternalPositions(e.target.checked)}
          />
          <span className="label-text">{copy.syncExternal}</span>
        </label>
      </div>
      <div className="form-control">
        <label className="label cursor-pointer justify-start gap-3">
          <input
            type="checkbox"
            className="toggle toggle-secondary"
            checked={manageExternalPositions}
            onChange={(e) => setManageExternalPositions(e.target.checked)}
          />
          <span className="label-text">{copy.manageExternal}</span>
        </label>
      </div>
      <div className="flex items-center gap-4 mt-2">
        <button
          className={`btn btn-outline btn-info ${testStatus === "loading" ? "loading" : ""}`}
          type="button"
          onClick={handleTest}
          disabled={testStatus === "loading" || !exchangeSupportsProbe}
        >
          {testStatus === "loading" ? copy.testing : copy.testConnection}
        </button>
        {testStatus === "success" && <span className="text-success">{copy.ok}</span>}
        {testStatus === "error" && <span className="text-error">{copy.error}</span>}
      </div>
      {testMessage && (
        <p className={`text-sm ${testStatus === "error" ? "text-error" : "text-success"}`}>{testMessage}</p>
      )}
      <div className="flex gap-2 mt-4">
        <button className="btn btn-primary" type="submit">
          {copy.save}
        </button>
        <button className="btn btn-outline" type="button" onClick={onCancel}>
          {copy.cancel}
        </button>
      </div>
    </form>
  );
}
