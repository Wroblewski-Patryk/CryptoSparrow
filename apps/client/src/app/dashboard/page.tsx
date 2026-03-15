'use client';
import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageTitle } from 'apps/client/src/ui/layout/dashboard/PageTitle';
import { LoadingState } from 'apps/client/src/ui/components/ViewState';
import SafetyBar from 'apps/client/src/ui/layout/dashboard/SafetyBar';

const kpiCards = [
  { label: 'Open Positions', value: '3', tone: 'text-info' },
  { label: 'Open Orders', value: '7', tone: 'text-warning' },
  { label: 'Bots Running', value: '2', tone: 'text-success' },
  { label: 'Risk Alerts', value: '1', tone: 'text-error' },
];

const recentActivity = [
  { time: '09:42', text: 'Long BTCUSDT opened (paper mode).' },
  { time: '09:35', text: 'Limit order ETHUSDT partially filled.' },
  { time: '09:18', text: 'Bot "Breakout M15" restarted after config update.' },
];

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [loading, user]);

  if (loading) {
    return <LoadingState title='Ladowanie panelu dashboard' />;
  }

  return (
    <section className='w-full'>
        <PageTitle
          title='Control Center'
          breadcrumb={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Control Center' },
          ]}
        />

        <SafetyBar mode='PAPER' />

        <div className='alert mb-6'>
          <span>Signed in as {user?.email}</span>
        </div>

        <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
          {kpiCards.map((card) => (
            <div key={card.label} className='card bg-base-200 shadow-sm'>
              <div className='card-body p-5'>
                <p className='text-sm opacity-70'>{card.label}</p>
                <p className={`text-3xl font-bold ${card.tone}`}>{card.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className='grid gap-6 mt-6 xl:grid-cols-3'>
          <div className='card bg-base-200 shadow-sm xl:col-span-2'>
            <div className='card-body p-5'>
              <h2 className='card-title'>Positions Snapshot</h2>
              <div className='overflow-x-auto'>
                <table className='table table-zebra'>
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Side</th>
                      <th>Size</th>
                      <th>PnL</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>BTCUSDT</td>
                      <td>Long</td>
                      <td>0.040</td>
                      <td className='text-success'>+124.10 USDT</td>
                    </tr>
                    <tr>
                      <td>ETHUSDT</td>
                      <td>Long</td>
                      <td>0.320</td>
                      <td className='text-success'>+38.25 USDT</td>
                    </tr>
                    <tr>
                      <td>SOLUSDT</td>
                      <td>Short</td>
                      <td>14.000</td>
                      <td className='text-error'>-9.80 USDT</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className='card-actions justify-end'>
                <Link href='/dashboard/positions' className='btn btn-sm btn-outline'>
                  Open Positions
                </Link>
              </div>
            </div>
          </div>

          <div className='card bg-base-200 shadow-sm'>
            <div className='card-body p-5'>
              <h2 className='card-title'>Quick Actions</h2>
              <div className='flex flex-col gap-2'>
                <Link href='/dashboard/strategies' className='btn btn-primary btn-sm'>
                  Review Strategies
                </Link>
                <Link href='/dashboard/orders' className='btn btn-outline btn-sm'>
                  Open Orders
                </Link>
                <Link href='/dashboard/backtest' className='btn btn-outline btn-sm'>
                  Run Backtest
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className='grid gap-6 mt-6 xl:grid-cols-2'>
          <div className='card bg-base-200 shadow-sm'>
            <div className='card-body p-5'>
              <h2 className='card-title'>Orders Snapshot</h2>
              <div className='stats stats-vertical lg:stats-horizontal w-full shadow bg-base-100'>
                <div className='stat'>
                  <div className='stat-title'>Pending</div>
                  <div className='stat-value text-warning text-2xl'>5</div>
                </div>
                <div className='stat'>
                  <div className='stat-title'>Filled (24h)</div>
                  <div className='stat-value text-success text-2xl'>18</div>
                </div>
                <div className='stat'>
                  <div className='stat-title'>Rejected (24h)</div>
                  <div className='stat-value text-error text-2xl'>1</div>
                </div>
              </div>
              <div className='card-actions justify-end'>
                <Link href='/dashboard/orders' className='btn btn-sm btn-outline'>
                  Open Orders
                </Link>
              </div>
            </div>
          </div>

          <div className='card bg-base-200 shadow-sm'>
            <div className='card-body p-5'>
              <h2 className='card-title'>Recent Activity</h2>
              <ul className='timeline timeline-vertical'>
                {recentActivity.map((item) => (
                  <li key={`${item.time}-${item.text}`}>
                    <div className='timeline-start text-xs opacity-60'>{item.time}</div>
                    <div className='timeline-middle'>•</div>
                    <div className='timeline-end py-2 text-sm'>{item.text}</div>
                    <hr />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className='mt-6'>
          <div className='alert alert-info'>
            <span>Data above is temporary UI seed data and will be connected to live modules in upcoming tasks.</span>
          </div>
        </div>
    </section>
  );
}
