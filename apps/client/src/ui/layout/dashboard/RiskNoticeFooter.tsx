import Link from 'next/link';

export default function RiskNoticeFooter() {
  return (
    <div className='mt-6 rounded-xl border border-warning/30 bg-warning/10 p-4'>
      <p className='text-sm font-semibold'>
        Trading risk notice: decyzje automatyczne moga powodowac realne straty kapitalu.
      </p>
      <p className='mt-1 text-sm opacity-80'>
        Przed wlaczeniem LIVE upewnij sie, ze limity ryzyka, emergency stop i klucze API sa poprawnie
        skonfigurowane.
      </p>
      <div className='mt-3 flex flex-wrap gap-2'>
        <Link href='/dashboard/logs' className='btn btn-outline btn-xs'>
          Open Audit Logs
        </Link>
        <Link href='/dashboard/profile#security' className='btn btn-ghost btn-xs'>
          Security Settings
        </Link>
      </div>
    </div>
  );
}
