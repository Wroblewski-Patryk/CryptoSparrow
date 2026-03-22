type BaseStateProps = {
  title: string;
  description?: string;
};

export function LoadingState({
  title = "Ladowanie danych",
  description = "Poczekaj chwile, przygotowujemy widok.",
}: Partial<BaseStateProps>) {
  return (
    <div className="alert alert-info">
      <span className="loading loading-spinner loading-sm" />
      <div>
        <div className="font-semibold">{title}</div>
        <div className="text-sm opacity-80">{description}</div>
      </div>
    </div>
  );
}

type EmptyStateProps = BaseStateProps & {
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-base-300 bg-base-200 p-6 text-center">
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="mt-2 text-sm opacity-80">{description}</p>}
      {actionLabel && onAction && (
        <button type="button" className="btn btn-primary btn-sm mt-4" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

type ErrorStateProps = BaseStateProps & {
  retryLabel?: string;
  onRetry?: () => void;
};

export function ErrorState({
  title,
  description,
  retryLabel,
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="alert alert-error">
      <div>
        <div className="font-semibold">{title}</div>
        {description && <div className="text-sm">{description}</div>}
      </div>
      {retryLabel && onRetry && (
        <button type="button" className="btn btn-sm" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  );
}

export function DegradedState({ title, description }: BaseStateProps) {
  return (
    <div className="alert alert-warning">
      <div>
        <div className="font-semibold">{title}</div>
        {description && <div className="text-sm">{description}</div>}
      </div>
    </div>
  );
}

export function SuccessState({ title, description }: BaseStateProps) {
  return (
    <div className="alert alert-success">
      <div>
        <div className="font-semibold">{title}</div>
        {description && <div className="text-sm">{description}</div>}
      </div>
    </div>
  );
}
