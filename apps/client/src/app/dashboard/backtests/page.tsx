import { redirect } from 'next/navigation';

export default function BacktestsIndexRedirectPage() {
  redirect('/dashboard/backtests/list');
}
