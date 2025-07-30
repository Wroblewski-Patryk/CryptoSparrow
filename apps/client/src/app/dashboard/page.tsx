'use client';
import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [loading, user]);

  if (loading) return null;

  return (
    <div className='w-full'>
      <div className="max-w-7xl mx-auto py-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p>Witaj, {user?.email}</p>
        
      </div>
    </div>
  );
}
