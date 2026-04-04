'use client';

import Link from 'next/link';
import { type ReactNode } from 'react';

type ActionTone = 'neutral' | 'info' | 'danger';
type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const actionClassByTone: Record<ActionTone, string> = {
  neutral:
    'btn btn-square btn-xs h-7 min-h-7 w-7 border border-base-300 bg-base-100/60 text-base-content/75 transition-colors duration-150 hover:border-base-content/35 hover:bg-base-100 hover:text-base-content',
  info:
    'btn btn-square btn-xs h-7 min-h-7 w-7 border border-info/45 bg-info/10 text-info transition-colors duration-150 hover:border-info/70 hover:bg-info/20',
  danger:
    'btn btn-square btn-xs h-7 min-h-7 w-7 border border-error/45 bg-error/10 text-error transition-colors duration-150 hover:border-error/70 hover:bg-error/20',
};

const badgeClassByTone: Record<BadgeTone, string> = {
  neutral: 'badge badge-sm badge-outline border-base-content/20 bg-base-100/40 text-base-content/70',
  info: 'badge badge-sm badge-outline border-info/45 bg-info/10 text-info',
  success: 'badge badge-sm badge-outline border-success/45 bg-success/10 text-success',
  warning: 'badge badge-sm badge-outline border-warning/45 bg-warning/10 text-warning',
  danger: 'badge badge-sm badge-outline border-error/45 bg-error/10 text-error',
};

type TableIconLinkActionProps = {
  href: string;
  label: string;
  icon: ReactNode;
  tone?: ActionTone;
};

export function TableIconLinkAction({
  href,
  label,
  icon,
  tone = 'neutral',
}: TableIconLinkActionProps) {
  return (
    <span className='tooltip tooltip-left' data-tip={label}>
      <Link href={href} className={actionClassByTone[tone]} aria-label={label}>
        {icon}
      </Link>
    </span>
  );
}

type TableIconButtonActionProps = {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  tone?: ActionTone;
  type?: 'button' | 'submit';
  disabled?: boolean;
};

export function TableIconButtonAction({
  label,
  icon,
  onClick,
  tone = 'neutral',
  type = 'button',
  disabled = false,
}: TableIconButtonActionProps) {
  return (
    <span className='tooltip tooltip-left' data-tip={label}>
      <button
        type={type}
        className={actionClassByTone[tone]}
        onClick={onClick}
        aria-label={label}
        disabled={disabled}
      >
        {icon}
      </button>
    </span>
  );
}

type TableToneBadgeProps = {
  label: string;
  tone?: BadgeTone;
  className?: string;
};

export function TableToneBadge({ label, tone = 'neutral', className = '' }: TableToneBadgeProps) {
  return <span className={`${badgeClassByTone[tone]} ${className}`.trim()}>{label}</span>;
}
