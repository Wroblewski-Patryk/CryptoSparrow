'use client';
import { useAuth } from '../../../context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useI18n } from '../../../i18n/I18nProvider';
import LoginForm from '../components/LoginForm';

export default function LoginPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  return (
    <section className="hero flex-1 min-h-full bg-base-200 px-4 py-8 md:px-6 md:py-12">
      <div className="hero-content w-full max-w-6xl flex-col gap-8 p-0 lg:flex-row-reverse lg:gap-12">
        <div className="max-w-xl text-center lg:text-left">
          <h1 className="text-4xl font-bold md:text-5xl">{t('auth.page.login.title')}</h1>
          <p className="py-4 text-base-content/75 md:py-6">{t('auth.page.login.description')}</p>
        </div>
        <div className="card bg-base-100 w-full max-w-md shrink-0 shadow-xl">
          <div className="card-body">
            <LoginForm />
          </div>
        </div>
      </div>
    </section>
  );
}
