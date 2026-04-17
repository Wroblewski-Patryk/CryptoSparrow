import Link from 'next/link';
import { useContext, useState } from 'react';
import { useLoginForm } from '../hooks/useLoginForm';
import PasswordVisibilityToggle from './PasswordVisibilityToggle';
import { I18nContext } from '@/i18n/I18nProvider';

export default function LoginForm() {
  const { register, onFormSubmit, errors, isSubmitting, serverError } = useLoginForm();
  const [showPassword, setShowPassword] = useState(false);
  const i18n = useContext(I18nContext);
  const locale = i18n?.locale ?? 'en';
  const copy = {
    en: {
      email: 'Email',
      emailPlaceholder: 'name@example.com',
      password: 'Password',
      passwordPlaceholder: '********',
      rememberDevice: 'Remember this device',
      submitIdle: 'Sign in',
      submitPending: 'Signing in...',
      noAccount: "Don't have an account?",
      createOne: 'Create one',
      passwordResetSoon: 'Password reset will be available soon.',
    },
    pl: {
      email: 'Email',
      emailPlaceholder: 'name@example.com',
      password: 'Haslo',
      passwordPlaceholder: '********',
      rememberDevice: 'Zapamietaj to urzadzenie',
      submitIdle: 'Zaloguj sie',
      submitPending: 'Logowanie...',
      noAccount: 'Nie masz konta?',
      createOne: 'Utworz konto',
      passwordResetSoon: 'Reset hasla bedzie dostepny wkrotce.',
    },
    pt: {
      email: 'Email',
      emailPlaceholder: 'name@example.com',
      password: 'Password',
      passwordPlaceholder: '********',
      rememberDevice: 'Lembrar este dispositivo',
      submitIdle: 'Entrar',
      submitPending: 'A entrar...',
      noAccount: 'Nao tens conta?',
      createOne: 'Criar conta',
      passwordResetSoon: 'Reset de password disponivel em breve.',
    },
  } as const;
  const labels = copy[locale];

  return (
    <form onSubmit={onFormSubmit} className='form' noValidate>
      <fieldset className='fieldset'>
        <label className='label' htmlFor='email'>
          {labels.email}
        </label>
        <input
          id='email'
          type='email'
          className={`input input-bordered w-full ${errors.email ? 'input-error' : ''}`}
          placeholder={labels.emailPlaceholder}
          disabled={isSubmitting}
          {...register('email')}
        />
        {errors.email && <div className='text-error text-sm mt-1'>{errors.email.message}</div>}

        <label className='label' htmlFor='password'>
          {labels.password}
        </label>
        <div className='join w-full'>
          <input
            id='password'
            type={showPassword ? 'text' : 'password'}
            className={`input input-bordered join-item w-full ${errors.password ? 'input-error' : ''}`}
            placeholder={labels.passwordPlaceholder}
            disabled={isSubmitting}
            {...register('password')}
          />
          <PasswordVisibilityToggle
            show={showPassword}
            disabled={isSubmitting}
            onToggle={() => setShowPassword((prev) => !prev)}
          />
        </div>
        {errors.password && <div className='text-error text-sm mt-1'>{errors.password.message}</div>}

        <label htmlFor='remember' className='label'>
          <input
            id='remember'
            type='checkbox'
            className='checkbox mt-4 mr-1'
            disabled={isSubmitting}
            {...register('remember')}
          />
          <span className='pt-4'>{labels.rememberDevice}</span>
        </label>

        {serverError && <div className='alert alert-error mt-2 text-sm'>{serverError}</div>}

        <button type='submit' className='btn btn-primary mt-4 mb-4' disabled={isSubmitting}>
          {isSubmitting ? labels.submitPending : labels.submitIdle}
        </button>

        <p className='text-center'>
          {labels.noAccount}{' '}
          <Link href='/auth/register' className='link link-hover'>
            {labels.createOne}
          </Link>
        </p>
        <p className='text-center'>
          <span className='opacity-70'>{labels.passwordResetSoon}</span>
        </p>
      </fieldset>
    </form>
  );
}
