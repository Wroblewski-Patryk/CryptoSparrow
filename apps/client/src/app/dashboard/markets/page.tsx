import { PageTitle } from 'apps/client/src/ui/layout/dashboard/PageTitle';
import MarketsFlow from 'apps/client/src/features/markets/components/MarketsFlow';

export default function MarketsPage() {
  return (
    <section className='w-full'>
      <PageTitle
        title='Market Universes'
        breadcrumb={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Markets' },
        ]}
      />
      <MarketsFlow />
    </section>
  );
}
