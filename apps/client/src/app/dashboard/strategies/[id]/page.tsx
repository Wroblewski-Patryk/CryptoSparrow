import { redirect } from 'next/navigation';

type StrategiesEditRedirectPageProps = {
  params: Promise<{ id: string }>;
};

export default async function StrategiesEditRedirectPage({ params }: StrategiesEditRedirectPageProps) {
  const { id } = await params;
  redirect(`/dashboard/strategies/${id}/edit`);
}
