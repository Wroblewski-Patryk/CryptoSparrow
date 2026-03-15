'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api';

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

  return (
    <div className='sticky top-16 z-30 mb-4 rounded-xl border border-base-300 bg-base-200/95 px-4 py-3 shadow-sm backdrop-blur'>
      <div className='flex flex-wrap items-center gap-3'>
        <span className='badge badge-outline'>Mode: {mode}</span>
        <span className={`badge ${isOnline ? 'badge-success' : 'badge-error'}`}>
          {isOnline ? 'Connectivity: Online' : 'Connectivity: Offline'}
        </span>
        <span className={`badge ${degraded ? 'badge-warning' : 'badge-info'}`}>
          {degraded
            ? 'Heartbeat: Delayed'
            : `Heartbeat: ${heartbeatAt ? `OK (${heartbeatAt})` : 'Checking...'}`}
        </span>

        <button
          type='button'
          className='btn btn-error btn-xs ml-auto'
          onClick={() => router.push('/dashboard/profile#security')}
        >
          Emergency Stop
        </button>
      </div>
    </div>
  );
}
