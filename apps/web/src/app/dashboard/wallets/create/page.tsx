import { redirect } from 'next/navigation';

import { dashboardRoutes } from '@/ui/layout/dashboard/dashboardRoutes';
import WalletFormPageContent from '../_components/WalletFormPageContent';

type WalletCreatePageProps = {
  searchParams?: Promise<{
    editId?: string;
  }>;
};

export default async function WalletCreatePage({ searchParams }: WalletCreatePageProps) {
  const params = searchParams ? await searchParams : undefined;
  const editId = params?.editId?.trim() ? params.editId : null;

  if (editId) {
    redirect(dashboardRoutes.wallets.edit(editId));
  }

  return <WalletFormPageContent mode='create' />;
}
