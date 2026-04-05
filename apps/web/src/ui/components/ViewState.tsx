type BaseStateProps = {
  title: string;
  description?: string;
};

import {
  SkeletonCardBlock,
  SkeletonFormBlock,
  SkeletonKpiRow,
  SkeletonTableRows,
} from './loading';

type LoadingStateVariant = 'table' | 'cards' | 'form' | 'kpi';

type LoadingStateProps = Partial<BaseStateProps> & {
  variant?: LoadingStateVariant;
};

export function LoadingState({
  title = "Ladowanie danych",
  description = "Poczekaj chwile, przygotowujemy widok.",
  variant = 'table',
}: LoadingStateProps) {
  const skeletonContent =
    variant === 'cards' ? (
      <SkeletonCardBlock cards={3} title={false} />
    ) : variant === 'form' ? (
      <SkeletonFormBlock fields={6} title={false} />
    ) : variant === 'kpi' ? (
      <SkeletonKpiRow items={4} />
    ) : (
      <SkeletonTableRows columns={7} rows={5} title={false} />
    );

  return (
    <section
      aria-busy='true'
      aria-label={title}
      className='space-y-3 rounded-box border border-base-300/60 bg-base-100/80 p-4'
    >
      <div>
        <h3 className='text-base font-semibold'>{title}</h3>
        <p className='text-sm opacity-70'>{description}</p>
      </div>
      {skeletonContent}
    </section>
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
