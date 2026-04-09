import { redirect } from 'next/navigation';

import { dashboardRoutes } from '@/ui/layout/dashboard/dashboardRoutes';

type WalletDetailsRedirectPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function WalletDetailsRedirectPage({ params }: WalletDetailsRedirectPageProps) {
  const { id } = await params;
  redirect(dashboardRoutes.wallets.edit(id));
}
