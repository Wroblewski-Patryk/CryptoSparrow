'use client';
import { useAuth } from '../../../context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import RegisterForm from '../components/RegisterForm';

export default function RegisterPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading]);

  if (loading) return null;
  
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <RegisterForm/>
    </main>
  );
}
