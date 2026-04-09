import WalletFormPageContent from '../../_components/WalletFormPageContent';

type WalletEditPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function WalletEditPage({ params }: WalletEditPageProps) {
  const { id } = await params;
  return <WalletFormPageContent mode='edit' editId={id} />;
}
