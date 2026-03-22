import { redirect } from 'next/navigation';

export default function BacktestAddLegacyRedirectPage() {
  redirect('/dashboard/backtests/create');
}
