import { redirect } from 'next/navigation';

export default function BacktestLegacyRedirectPage() {
  redirect('/dashboard/backtests/list');
}
