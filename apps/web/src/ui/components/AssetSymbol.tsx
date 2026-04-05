import { useMemo, useState } from "react";

type AssetSymbolProps = {
  symbol: string;
  iconUrl?: string | null;
  loading?: boolean;
  hasError?: boolean;
  className?: string;
};

const normalizeSymbol = (value: string) => value.trim().toUpperCase();

const fallbackLabelFromSymbol = (symbol: string) => {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) return "?";
  return normalized[0] ?? "?";
};

export default function AssetSymbol(props: AssetSymbolProps) {
  const normalizedSymbol = useMemo(() => normalizeSymbol(props.symbol), [props.symbol]);
  const fallbackLabel = useMemo(() => fallbackLabelFromSymbol(normalizedSymbol), [normalizedSymbol]);
  const [imageFailed, setImageFailed] = useState(false);
  const shouldShowImage = Boolean(props.iconUrl) && !imageFailed;

  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${props.className ?? ""}`}>
      {props.loading && !shouldShowImage ? (
        <span className="inline-flex h-4 w-4 shrink-0 animate-pulse rounded-full bg-base-300/70" aria-hidden />
      ) : shouldShowImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={props.iconUrl ?? undefined}
          alt={`${normalizedSymbol} icon`}
          className="h-4 w-4 shrink-0 rounded-full"
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span
          className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] font-semibold ${
            props.hasError ? "border-error/40 bg-error/10 text-error" : "border-base-300 bg-base-100 text-base-content/70"
          }`}
          aria-hidden
        >
          {fallbackLabel}
        </span>
      )}
      <span className="truncate">{normalizedSymbol}</span>
    </span>
  );
}
