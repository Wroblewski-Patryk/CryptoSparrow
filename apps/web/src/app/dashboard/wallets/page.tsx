import { redirect } from 'next/navigation';

export default function WalletsIndexPage() {
  redirect('/dashboard/wallets/list');
}
