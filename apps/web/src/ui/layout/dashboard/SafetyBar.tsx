'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api';
import StatusBadge from '../../components/StatusBadge';

type Mode = 'PAPER' | 'LIVE' | 'LOCAL';

type SafetyBarProps = {
  mode?: Mode;
};

const HEARTBEAT_INTERVAL_MS = 20_000;

export default function SafetyBar({ mode = 'PAPER' }: SafetyBarProps) {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
  const [heartbeatAt, setHeartbeatAt] = useState<string | null>(null);
  const [degraded, setDegraded] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const runHeartbeat = async () => {
      try {
        await api.get('/auth/me');
        if (!cancelled) {
          setDegraded(false);
          setHeartbeatAt(new Date().toLocaleTimeString());
        }
      } catch {
        if (!cancelled) setDegraded(true);
      }
    };

    void runHeartbeat();
    const id = window.setInterval(() => {
      void runHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const modeValue = mode.toLowerCase() as 'paper' | 'live' | 'local';

  return (
    <div className='sticky top-16 z-30 mb-4 rounded-box border border-base-300/60 bg-base-100/85 px-3 py-3 backdrop-blur sm:px-4'>
      <p className='sr-only' aria-live='polite'>
        {`Connectivity ${isOnline ? 'online' : 'offline'}. Heartbeat ${
          degraded ? 'delayed' : heartbeatAt ? `ok at ${heartbeatAt}` : 'checking'
        }.`}
      </p>
      <div className='flex flex-wrap items-center gap-3'>
        <StatusBadge kind='mode' value={modeValue} />
        <StatusBadge
          kind='risk'
          value={isOnline ? 'safe' : 'danger'}
          label={isOnline ? 'Connectivity: Online' : 'Connectivity: Offline'}
        />
        <StatusBadge
          kind='risk'
          value={degraded ? 'warning' : 'safe'}
          label={
            degraded
              ? 'Heartbeat: Delayed'
              : `Heartbeat: ${heartbeatAt ? `OK (${heartbeatAt})` : 'Checking...'}`
          }
        />

        <button
          type='button'
          className='btn btn-error btn-xs w-full sm:ml-auto sm:w-auto'
          onClick={() => router.push('/dashboard/profile#security')}
        >
          Emergency Stop
        </button>
      </div>
    </div>
  );
}
