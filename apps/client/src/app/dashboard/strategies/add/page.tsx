import { redirect } from 'next/navigation';

export default function StrategiesAddRedirectPage() {
  redirect('/dashboard/strategies/create');
}
