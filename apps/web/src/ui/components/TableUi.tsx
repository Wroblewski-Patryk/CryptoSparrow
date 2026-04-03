'use client';

import Link from 'next/link';
import { type ReactNode } from 'react';

type ActionTone = 'neutral' | 'info' | 'danger';
type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const actionClassByTone: Record<ActionTone, string> = {
  neutral:
    'btn btn-square btn-xs h-7 min-h-7 w-7 border border-base-content/35 bg-base-100/40 text-base-content/75 transition-colors duration-150 hover:border-base-content/55 hover:bg-base-100 hover:text-base-content',
  info:
    'btn btn-square btn-xs h-7 min-h-7 w-7 border border-sky-500/45 bg-sky-500/10 text-sky-500 transition-colors duration-150 hover:border-sky-500/70 hover:bg-sky-500/20',
  danger:
    'btn btn-square btn-xs h-7 min-h-7 w-7 border border-rose-500/45 bg-rose-500/10 text-rose-500 transition-colors duration-150 hover:border-rose-500/70 hover:bg-rose-500/20',
};

const badgeClassByTone: Record<BadgeTone, string> = {
  neutral: 'badge badge-sm badge-outline border-base-content/20 bg-base-100/40 text-base-content/70',
  info: 'badge badge-sm badge-outline border-sky-500/45 bg-sky-500/10 text-sky-500',
  success: 'badge badge-sm badge-outline border-emerald-500/45 bg-emerald-500/10 text-emerald-500',
  warning: 'badge badge-sm badge-outline border-amber-500/45 bg-amber-500/10 text-amber-500',
  danger: 'badge badge-sm badge-outline border-rose-500/45 bg-rose-500/10 text-rose-500',
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

