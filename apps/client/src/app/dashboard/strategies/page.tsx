import { redirect } from 'next/navigation';

export default function StrategiesIndexRedirectPage() {
  redirect('/dashboard/strategies/list');
}
