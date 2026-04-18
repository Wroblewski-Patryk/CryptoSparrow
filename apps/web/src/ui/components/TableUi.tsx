'use client';

import Link from 'next/link';
import { type ReactNode } from 'react';
import { LuActivity, LuCopy, LuEye, LuListTree, LuPencilLine, LuTrash2 } from 'react-icons/lu';

type ActionTone = 'neutral' | 'info' | 'danger';
type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
export type TableActionPreset = 'edit' | 'delete' | 'clone' | 'preview' | 'runtime' | 'details';

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

type ActionPresetConfig = {
  tone: ActionTone;
  icon: ReactNode;
};

const actionPresetConfig: Record<TableActionPreset, ActionPresetConfig> = {
  edit: {
    tone: 'info',
    icon: <LuPencilLine className='h-3.5 w-3.5' />,
  },
  delete: {
    tone: 'danger',
    icon: <LuTrash2 className='h-3.5 w-3.5' />,
  },
  clone: {
    tone: 'neutral',
    icon: <LuCopy className='h-3.5 w-3.5' />,
  },
  preview: {
    tone: 'neutral',
    icon: <LuEye className='h-3.5 w-3.5' />,
  },
  runtime: {
    tone: 'info',
    icon: <LuActivity className='h-3.5 w-3.5' />,
  },
  details: {
    tone: 'neutral',
    icon: <LuListTree className='h-3.5 w-3.5' />,
  },
};

export const resolveTableActionPreset = (preset: TableActionPreset): ActionPresetConfig => actionPresetConfig[preset];

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

type TablePresetLinkActionProps = Omit<TableIconLinkActionProps, 'icon' | 'tone'> & {
  preset: TableActionPreset;
  icon?: ReactNode;
};

export function TablePresetLinkAction({
  preset,
  icon,
  ...props
}: TablePresetLinkActionProps) {
  const resolved = resolveTableActionPreset(preset);
  return (
    <TableIconLinkAction
      {...props}
      tone={resolved.tone}
      icon={icon ?? resolved.icon}
    />
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

type TablePresetButtonActionProps = Omit<TableIconButtonActionProps, 'icon' | 'tone'> & {
  preset: TableActionPreset;
  icon?: ReactNode;
};

export function TablePresetButtonAction({
  preset,
  icon,
  ...props
}: TablePresetButtonActionProps) {
  const resolved = resolveTableActionPreset(preset);
  return (
    <TableIconButtonAction
      {...props}
      tone={resolved.tone}
      icon={icon ?? resolved.icon}
    />
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
