'use client';

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../../../i18n/I18nProvider";
import { useLocaleFormatting } from "../../../i18n/useLocaleFormatting";
import { createMarketStreamEventSource } from "../../../lib/marketStream";

type TickerEventPayload = {
  symbol: string;
  lastPrice: number;
  priceChangePercent24h: number;
  eventTime: number;
};

type CandleEventPayload = {
  symbol: string;
  closeTime: number;
  isFinal: boolean;
};

type HealthEventPayload = {
  connected: boolean;
  lastEventAt?: number;
  lagMs?: number;
};

type MarketRow = {
  symbol: string;
  lastPrice: number | null;
  delta24h: number | null;
  candleFreshAt: number | null;
};

type LiveMarketBarProps = {
  symbols: string[];
  interval: string;
};

export default function LiveMarketBar({ symbols, interval }: LiveMarketBarProps) {
  const { t } = useI18n();
  const { formatNumber } = useLocaleFormatting();
  const [rows, setRows] = useState<MarketRow[]>(
    symbols.map((symbol) => ({
      symbol,
      lastPrice: null,
      delta24h: null,
      candleFreshAt: null,
    }))
  );
  const [isConnected, setIsConnected] = useState(false);
  const [streamLagMs, setStreamLagMs] = useState<number | null>(null);

  useEffect(() => {
    const uniqueSymbols = [...new Set(symbols.map((item) => item.toUpperCase()))];
    setRows(
      uniqueSymbols.map((symbol) => ({
        symbol,
        lastPrice: null,
        delta24h: null,
        candleFreshAt: null,
      }))
    );

    const supportsEventSource =
      typeof window !== "undefined" && typeof window.EventSource !== "undefined";
    if (!supportsEventSource) {
      setIsConnected(false);
      return;
    }

    const source = createMarketStreamEventSource({
      symbols: uniqueSymbols,
      interval,
    });

    source.addEventListener("ticker", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as TickerEventPayload;
      setRows((prev) =>
        prev.map((row) =>
          row.symbol === data.symbol
            ? { ...row, lastPrice: data.lastPrice, delta24h: data.priceChangePercent24h }
            : row
        )
      );
    });

    source.addEventListener("candle", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as CandleEventPayload;
      if (!data.isFinal) return;
      setRows((prev) =>
        prev.map((row) =>
          row.symbol === data.symbol ? { ...row, candleFreshAt: data.closeTime } : row
        )
      );
    });

    source.addEventListener("health", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as HealthEventPayload;
      setIsConnected(Boolean(data.connected));
      setStreamLagMs(typeof data.lagMs === "number" ? data.lagMs : null);
    });

    source.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      source.close();
    };
  }, [interval, symbols]);

  const healthText = useMemo(() => {
    if (!isConnected) return t("dashboard.liveMarket.streamDisconnected");
    if (streamLagMs == null) return t("dashboard.liveMarket.streamConnected");
    return t("dashboard.liveMarket.streamConnectedLag").replace("{lag}", String(streamLagMs));
  }, [isConnected, streamLagMs, t]);

  const formatPrice = (value: number | null) => {
    if (value == null) return t("dashboard.liveMarket.valueUnknown");
    return formatNumber(value, { maximumFractionDigits: 6 });
  };

  const formatPercent = (value: number | null) => {
    if (value == null) return t("dashboard.liveMarket.valueUnknown");
    const prefix = value > 0 ? "+" : "";
    return `${prefix}${formatNumber(value, { maximumFractionDigits: 2 })}%`;
  };

  const getFreshnessLabel = (timestamp: number | null) => {
    if (!timestamp) return t("dashboard.liveMarket.noCandle");
    const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (seconds < 30) return t("dashboard.liveMarket.candleFresh");
    if (seconds < 120) {
      return t("dashboard.liveMarket.candleAgoSeconds").replace("{seconds}", String(seconds));
    }
    return t("dashboard.liveMarket.candleAgoMinutes").replace(
      "{minutes}",
      String(Math.floor(seconds / 60))
    );
  };

  return (
    <div className="card bg-base-200 shadow-sm">
      <div className="card-body p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="card-title text-base">{t("dashboard.liveMarket.title")}</h2>
          <span
            className={`badge badge-sm ${isConnected ? "badge-success" : "badge-warning"}`}
            aria-live="polite"
          >
            {healthText}
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((row) => (
            <div key={row.symbol} className="rounded-lg border border-base-300 bg-base-100 p-3">
              <div className="flex items-center justify-between">
                <strong>{row.symbol}</strong>
                <span className="text-xs opacity-70">candle {getFreshnessLabel(row.candleFreshAt)}</span>
              </div>
              <div className="mt-1 text-lg font-semibold">{formatPrice(row.lastPrice)}</div>
              <div
                className={`text-sm ${
                  row.delta24h == null ? "opacity-70" : row.delta24h >= 0 ? "text-success" : "text-error"
                }`}
              >
                {t("dashboard.liveMarket.delta24hLabel")}: {formatPercent(row.delta24h)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
