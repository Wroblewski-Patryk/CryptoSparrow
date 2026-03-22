'use client';

import ApiKeysList from "../../profile/components/ApiKeysList";
import { useApiKeys } from "../../profile/hooks/useApiKeys";
import { ErrorState, LoadingState, SuccessState } from "../../../ui/components/ViewState";
import { useLocaleFormatting } from "../../../i18n/useLocaleFormatting";

export default function ExchangeConnectionsView() {
  const { formatDateTime } = useLocaleFormatting();
  const { keys, loading, error, refresh } = useApiKeys();

  const connectedExchanges = new Set(keys.map((key) => key.exchange)).size;
  const lastUsed = keys
    .map((key) => key.lastUsed)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => (a < b ? 1 : -1))[0];

  return (
    <div className="space-y-4">
      {loading && <LoadingState title="Ladowanie polaczen exchange" />}
      {!loading && error && (
        <ErrorState
          title="Nie udalo sie pobrac polaczen exchange"
          description={error}
          retryLabel="Sprobuj ponownie"
          onRetry={() => void refresh()}
        />
      )}

      {!loading && !error && (
        <>
          <SuccessState
            title="Exchange connections gotowe"
            description="Klucze API sa maskowane i przechowywane w formie zaszyfrowanej."
          />

          <div className="grid gap-4 md:grid-cols-3">
            <div className="card bg-base-200 shadow-sm">
              <div className="card-body p-4">
                <p className="text-sm opacity-70">Connected Exchanges</p>
                <p className="text-3xl font-bold">{connectedExchanges}</p>
              </div>
            </div>
            <div className="card bg-base-200 shadow-sm">
              <div className="card-body p-4">
                <p className="text-sm opacity-70">API Keys</p>
                <p className="text-3xl font-bold">{keys.length}</p>
              </div>
            </div>
            <div className="card bg-base-200 shadow-sm">
              <div className="card-body p-4">
                <p className="text-sm opacity-70">Last Used</p>
                <p className="text-base font-semibold">{formatDateTime(lastUsed)}</p>
              </div>
            </div>
          </div>
        </>
      )}

      <ApiKeysList />
    </div>
  );
}
