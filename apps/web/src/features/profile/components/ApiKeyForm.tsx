"use client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ZodError } from "zod";
import { isAxiosError } from "axios";
import { apiKeySchema } from "../types/apiKeyForm.type";
import { testApiKeyConnection, testStoredApiKeyConnection } from "../services/apiKeys.service";
import { useI18n } from "../../../i18n/I18nProvider";
import { listBots } from "@/features/bots/services/bots.service";
import type { Bot } from "@/features/bots/types/bot.type";
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
    id?: string;
    label: string;
    exchange: ExchangeOption;
    maskedApiKey?: string;
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
          currentApiKey: "Aktualny API Key",
          apiSecret: "API Secret",
          apiKeyPlaceholder: "Podaj nowy API Key (opcjonalnie)",
          apiSecretPlaceholder: "Podaj nowy API Secret (opcjonalnie)",
          syncExternal: "Synchronizuj zewnetrzne pozycje z gieldy",
          manageExternal: "Zarzadzaj zewnetrznymi pozycjami przez bota",
          testing: "Testowanie...",
          testConnection: "Testuj polaczenie",
          testStoredConnection: "Testuj zapisane polaczenie",
          ok: "OK",
          error: "Blad",
          save: "Zapisz",
          cancel: "Anuluj",
          ipWhitelistTitle: "Whitelist IP (Binance)",
          ipWhitelistLead: "Dodaj backendowe IP do whitelisty klucza API Binance:",
          ipWhitelistMissing:
            "Adres backendowego IP nie jest skonfigurowany. Ustaw NEXT_PUBLIC_BINANCE_IP_WHITELIST w srodowisku web.",
          ipWhitelistHint:
            "Jesli test zwroci IP_RESTRICTED, sprawdz whitelist Binance i sproboj ponownie po propagacji zmian.",
          manageBotsTitle: "Boty gotowe do przejecia pozycji",
          manageBotsHint:
            "Pokazujemy aktywne boty LIVE z opt-in dla tej gieldy. Upewnij sie, ze bot ma przypiety ten klucz API.",
          manageBotsLoading: "Ladowanie listy botow...",
          manageBotsEmpty: "Brak aktywnych botow LIVE dla tej gieldy.",
          manageBotsLoadError: "Nie udalo sie pobrac listy botow.",
          botUsesThisKey: "Uzywa tego klucza",
          botUsesAnotherKey: "Uzywa innego klucza",
          botWithoutApiKey: "Brak przypietego klucza",
          editSecretHint:
            "API Secret nie jest wyswietlany. Pozostaw pola puste, aby przetestowac zapisane polaczenie dla tego klucza.",
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
          currentApiKey: "Current API Key",
          apiSecret: "API Secret",
          apiKeyPlaceholder: "Provide new API Key (optional)",
          apiSecretPlaceholder: "Provide new API Secret (optional)",
          syncExternal: "Sync external exchange positions",
          manageExternal: "Allow bot to manage external positions",
          testing: "Testing...",
          testConnection: "Test connection",
          testStoredConnection: "Test stored connection",
          ok: "OK",
          error: "Error",
          save: "Save",
          cancel: "Cancel",
          ipWhitelistTitle: "IP Whitelist (Binance)",
          ipWhitelistLead: "Add backend egress IP(s) to your Binance API key whitelist:",
          ipWhitelistMissing:
            "Backend egress IP is not configured. Set NEXT_PUBLIC_BINANCE_IP_WHITELIST in web environment.",
          ipWhitelistHint:
            "If test returns IP_RESTRICTED, update Binance whitelist and retry after propagation.",
          manageBotsTitle: "Bots ready to take over positions",
          manageBotsHint:
            "Showing active LIVE bots with live opt-in for this exchange. Ensure bot is bound to this API key.",
          manageBotsLoading: "Loading bots list...",
          manageBotsEmpty: "No active LIVE bots for this exchange.",
          manageBotsLoadError: "Could not load bots list.",
          botUsesThisKey: "Uses this key",
          botUsesAnotherKey: "Uses another key",
          botWithoutApiKey: "No API key assigned",
          editSecretHint:
            "API Secret is never shown. Leave both fields empty to test stored connection for this key.",
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
  const [manageableBots, setManageableBots] = useState<Bot[]>([]);
  const [manageBotsStatus, setManageBotsStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const currentFingerprint = `${exchange}::${apiKey}::${apiSecret}`;
  const currentApiKeyId = defaultValues?.id ?? null;
  const binanceWhitelistIps = (process.env.NEXT_PUBLIC_BINANCE_IP_WHITELIST ?? "")
    .split(",")
    .map((ip) => ip.trim())
    .filter((ip) => ip.length > 0);

  const exchangeSupportsProbe = supportsExchangeCapability(exchange, "API_KEY_PROBE");
  const requiresConnectionTest = (!isEdit || Boolean(apiKey) || Boolean(apiSecret)) && exchangeSupportsProbe;
  const isManageBotListVisible = manageExternalPositions && exchange === "BINANCE";
  const usesStoredTestMode =
    Boolean(isEdit && currentApiKeyId && exchange === defaultValues?.exchange) &&
    apiKey.trim().length === 0 &&
    apiSecret.trim().length === 0;

  useEffect(() => {
    if (!isManageBotListVisible) {
      setManageBotsStatus("idle");
      return;
    }

    let isCanceled = false;
    setManageBotsStatus("loading");

    void listBots()
      .then((bots) => {
        if (isCanceled) return;
        const eligibleBots = bots.filter(
          (bot) => bot.exchange === exchange && bot.mode === "LIVE" && bot.isActive && bot.liveOptIn
        );
        setManageableBots(eligibleBots);
        setManageBotsStatus("success");
      })
      .catch(() => {
        if (isCanceled) return;
        setManageableBots([]);
        setManageBotsStatus("error");
      });

    return () => {
      isCanceled = true;
    };
  }, [exchange, isManageBotListVisible]);

  const manageableBotRows = useMemo(
    () =>
      manageableBots.map((bot) => {
        let bindingLabel = copy.botWithoutApiKey;
        let bindingTone = "badge-ghost";

        if (bot.apiKeyId && currentApiKeyId && bot.apiKeyId === currentApiKeyId) {
          bindingLabel = copy.botUsesThisKey;
          bindingTone = "badge-success";
        } else if (bot.apiKeyId) {
          bindingLabel = copy.botUsesAnotherKey;
          bindingTone = "badge-warning";
        }

        return {
          id: bot.id,
          name: bot.name,
          marketType: bot.marketType,
          bindingLabel,
          bindingTone,
        };
      }),
    [copy.botUsesAnotherKey, copy.botUsesThisKey, copy.botWithoutApiKey, currentApiKeyId, manageableBots]
  );

  const handleTest = async () => {
    if (!exchangeSupportsProbe) {
      setTestStatus("idle");
      setTestMessage(copy.placeholderProbeInfo);
      setTestedFingerprint(null);
      return;
    }

    const canTestStoredConnection =
      usesStoredTestMode;

    if (canTestStoredConnection) {
      setTestStatus("loading");
      setTestMessage(null);

      try {
        const result = await testStoredApiKeyConnection(currentApiKeyId as string);
        if (result.ok) {
          setTestStatus("success");
          setTestMessage(result.message ?? copy.testConnectionOk);
          setTestedFingerprint(null);
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
      {exchange === "BINANCE" ? (
        <div className="alert alert-info text-sm">
          <div className="space-y-2">
            <span className="badge badge-xs badge-info badge-outline">{copy.ipWhitelistTitle}</span>
            {binanceWhitelistIps.length > 0 ? (
              <>
                <p>{copy.ipWhitelistLead}</p>
                <ul className="list-disc pl-5 font-mono">
                  {binanceWhitelistIps.map((ip) => (
                    <li key={ip}>{ip}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p>{copy.ipWhitelistMissing}</p>
            )}
            <p className="opacity-80">{copy.ipWhitelistHint}</p>
          </div>
        </div>
      ) : null}
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
        {isEdit && defaultValues?.maskedApiKey ? (
          <div className="text-xs opacity-70 mb-1">
            {copy.currentApiKey}: <span className="font-mono">{defaultValues.maskedApiKey}</span>
          </div>
        ) : null}
        <input
          className="input input-bordered w-full font-mono"
          type="text"
          aria-label={copy.apiKey}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={isEdit ? copy.apiKeyPlaceholder : ""}
          autoComplete="new-password"
          data-form-type="other"
          data-lpignore="true"
          spellCheck={false}
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
          autoComplete="new-password"
          data-form-type="other"
          data-lpignore="true"
          spellCheck={false}
          required={!isEdit}
        />
        {isEdit ? <p className="text-xs opacity-70 mt-1">{copy.editSecretHint}</p> : null}
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
      {isManageBotListVisible ? (
        <div className="rounded-box border border-base-300 bg-base-200/40 p-3 text-sm space-y-2">
          <p className="font-semibold">{copy.manageBotsTitle}</p>
          {manageBotsStatus === "loading" ? <p>{copy.manageBotsLoading}</p> : null}
          {manageBotsStatus === "error" ? <p className="text-error">{copy.manageBotsLoadError}</p> : null}
          {manageBotsStatus === "success" && manageableBotRows.length === 0 ? <p>{copy.manageBotsEmpty}</p> : null}
          {manageBotsStatus === "success" && manageableBotRows.length > 0 ? (
            <ul className="space-y-1.5">
              {manageableBotRows.map((bot) => (
                <li key={bot.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{bot.name}</span>
                  <span className="badge badge-outline badge-xs">{bot.marketType}</span>
                  <span className={`badge badge-xs ${bot.bindingTone}`}>{bot.bindingLabel}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="opacity-70">{copy.manageBotsHint}</p>
        </div>
      ) : null}
      <div className="flex items-center gap-3 mt-2 min-h-8">
        <button
          className="btn btn-outline btn-info min-w-44 justify-center gap-2"
          type="button"
          onClick={handleTest}
          disabled={testStatus === "loading" || !exchangeSupportsProbe}
        >
          {testStatus === "loading" ? (
            <span className="loading loading-spinner loading-xs" aria-hidden="true" />
          ) : null}
          <span>
            {testStatus === "loading"
              ? copy.testing
              : usesStoredTestMode
                ? copy.testStoredConnection
                : copy.testConnection}
          </span>
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
