'use client';

import { type ReactNode } from 'react';

type TableToolbarProps = {
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export default function TableToolbar({ children, actions, className = '' }: TableToolbarProps) {
  return (
    <div
      className={`flex flex-wrap items-end gap-3 rounded-box border border-base-300/60 bg-base-100/80 px-3 py-2 ${className}`.trim()}
    >
      <div className='flex flex-wrap items-end gap-3'>{children}</div>
      {actions ? <div className='ml-auto flex items-center gap-2'>{actions}</div> : null}
    </div>
  );
}
