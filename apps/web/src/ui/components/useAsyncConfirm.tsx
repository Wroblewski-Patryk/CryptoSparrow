'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ConfirmModal from './ConfirmModal';

type ConfirmVariant = 'primary' | 'error';

export type ConfirmRequest = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ConfirmVariant;
};

type Resolver = (accepted: boolean) => void;

export const useAsyncConfirm = () => {
  const resolverRef = useRef<Resolver | null>(null);
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  const settle = useCallback((accepted: boolean) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setRequest(null);
    resolve?.(accepted);
  }, []);

  const confirm = useCallback((nextRequest: ConfirmRequest) => {
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }

    setRequest(nextRequest);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  useEffect(
    () => () => {
      if (!resolverRef.current) return;
      resolverRef.current(false);
      resolverRef.current = null;
    },
    []
  );

  return {
    confirm,
    confirmModal: (
      <ConfirmModal
        open={Boolean(request)}
        title={request?.title ?? 'Confirm'}
        description={request?.description}
        confirmLabel={request?.confirmLabel}
        cancelLabel={request?.cancelLabel}
        confirmVariant={request?.confirmVariant}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />
    ),
  };
};
