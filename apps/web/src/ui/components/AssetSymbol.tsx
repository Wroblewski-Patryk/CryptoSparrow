import { useMemo, useState } from "react";

type AssetSymbolProps = {
  symbol: string;
  iconUrl?: string | null;
  loading?: boolean;
  hasError?: boolean;
  className?: string;
  iconClassName?: string;
  labelClassName?: string;
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
  const iconClassName = `shrink-0 rounded-full ${props.iconClassName ?? "h-4 w-4"}`;
  const loadingClassName = `inline-flex shrink-0 animate-pulse rounded-full bg-base-300/70 ${props.iconClassName ?? "h-4 w-4"}`;
  const fallbackClassName = `inline-flex shrink-0 items-center justify-center rounded-full border text-[9px] font-semibold ${props.iconClassName ?? "h-4 w-4"} ${
    props.hasError ? "border-error/40 bg-error/10 text-error" : "border-base-300 bg-base-100 text-base-content/70"
  }`;

  return (
    <span className={`inline-flex min-w-0 items-center align-middle gap-2 ${props.className ?? ""}`}>
      {props.loading && !shouldShowImage ? (
        <span className={loadingClassName} aria-hidden />
      ) : shouldShowImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={props.iconUrl ?? undefined}
          alt={`${normalizedSymbol} icon`}
          className={iconClassName}
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className={fallbackClassName} aria-hidden>
          {fallbackLabel}
        </span>
      )}
      <span className={`truncate leading-none ${props.labelClassName ?? ""}`}>{normalizedSymbol}</span>
    </span>
  );
}
