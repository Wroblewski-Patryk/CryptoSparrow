import BotFormPageContent from '../../_components/BotFormPageContent';

type BotsEditPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function BotsEditPage({ params }: BotsEditPageProps) {
  const { id } = await params;
  return <BotFormPageContent mode='edit' editId={id} />;
}

