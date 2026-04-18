import { redirect } from 'next/navigation';

import { dashboardRoutes } from '@/ui/layout/dashboard/dashboardRoutes';
import BotFormPageContent from '../_components/BotFormPageContent';

type BotsCreatePageProps = {
  searchParams?: Promise<{
    editId?: string;
  }>;
};

export default async function BotsCreatePage({ searchParams }: BotsCreatePageProps) {
  const params = searchParams ? await searchParams : undefined;
  const editId = params?.editId?.trim() ? params.editId : null;

  if (editId) {
    redirect(dashboardRoutes.bots.edit(editId));
  }

  return <BotFormPageContent mode='create' />;
}

