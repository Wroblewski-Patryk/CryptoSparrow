'use client';

import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';

type InlinePagerProps = {
  previousLabel: string;
  nextLabel: string;
  onPrevious: () => void;
  onNext: () => void;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
  size?: 'xs' | 'sm';
  hideLabelsOnMobile?: boolean;
  className?: string;
};

export default function InlinePager({
  previousLabel,
  nextLabel,
  onPrevious,
  onNext,
  previousDisabled = false,
  nextDisabled = false,
  size = 'sm',
  hideLabelsOnMobile = false,
  className = '',
}: InlinePagerProps) {
  const buttonClass =
    size === 'xs'
      ? 'btn btn-ghost btn-xs join-item h-7 min-h-7 gap-1 px-2'
      : 'btn btn-ghost btn-sm join-item h-8 min-h-8 gap-1.5 px-3';
  const iconClass = size === 'xs' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const labelClass = hideLabelsOnMobile ? 'hidden sm:inline' : '';

  return (
    <div className={`join rounded-box border border-base-300/60 bg-base-100/70 p-0.5 ${className}`.trim()}>
      <button
        type='button'
        className={buttonClass}
        disabled={previousDisabled}
        onClick={onPrevious}
        aria-label={previousLabel}
      >
        <LuChevronLeft className={iconClass} aria-hidden />
        <span className={labelClass}>{previousLabel}</span>
      </button>
      <button
        type='button'
        className={buttonClass}
        disabled={nextDisabled}
        onClick={onNext}
        aria-label={nextLabel}
      >
        <span className={labelClass}>{nextLabel}</span>
        <LuChevronRight className={iconClass} aria-hidden />
      </button>
    </div>
  );
}

