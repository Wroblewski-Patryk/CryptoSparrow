import Link from 'next/link';
import { useContext, useState } from 'react';
import { useRegisterForm } from '../hooks/useRegisterForm';
import PasswordVisibilityToggle from './PasswordVisibilityToggle';
import { I18nContext } from '@/i18n/I18nProvider';

export default function RegisterForm() {
  const { register, onFormSubmit, errors, isSubmitting } = useRegisterForm();
  const [showPassword, setShowPassword] = useState(false);
  const i18n = useContext(I18nContext);
  const locale = i18n?.locale ?? 'en';
  const copy = {
    en: {
      email: 'Email',
      emailPlaceholder: 'name@example.com',
      password: 'Password',
      passwordPlaceholder: '********',
      agreePrefix: 'I agree to the',
      terms: 'Terms of Service',
      agreeMiddle: 'and the',
      privacy: 'Privacy Policy',
      submitIdle: 'Create account',
      submitPending: 'Creating account...',
      haveAccount: 'Have an account?',
      signIn: 'Sign in',
      passwordResetSoon: 'Password reset will be available soon.',
    },
    pl: {
      email: 'Email',
      emailPlaceholder: 'name@example.com',
      password: 'Haslo',
      passwordPlaceholder: '********',
      agreePrefix: 'Akceptuje',
      terms: 'Regulamin',
      agreeMiddle: 'oraz',
      privacy: 'Polityke prywatnosci',
      submitIdle: 'Utworz konto',
      submitPending: 'Tworzenie konta...',
      haveAccount: 'Masz konto?',
      signIn: 'Zaloguj sie',
      passwordResetSoon: 'Reset hasla bedzie dostepny wkrotce.',
    },
    pt: {
      email: 'Email',
      emailPlaceholder: 'name@example.com',
      password: 'Password',
      passwordPlaceholder: '********',
      agreePrefix: 'Concordo com os',
      terms: 'Termos de Servico',
      agreeMiddle: 'e com a',
      privacy: 'Politica de Privacidade',
      submitIdle: 'Criar conta',
      submitPending: 'A criar conta...',
      haveAccount: 'Ja tens conta?',
      signIn: 'Entrar',
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

        <label htmlFor='terms' className='label'>
          <input id='terms' type='checkbox' className='checkbox mt-4 mr-1' disabled={isSubmitting} {...register('terms')} />
          <span className='pt-4'>
            {labels.agreePrefix}{' '}
            <Link href='/terms' className='link link-hover'>
              {labels.terms}
            </Link>{' '}
            {labels.agreeMiddle}{' '}
            <Link href='/privacy' className='link link-hover'>
              {labels.privacy}
            </Link>
          </span>
        </label>
        {errors.terms && <div className='text-error text-sm mt-1'>{errors.terms.message}</div>}

        <button type='submit' className='btn btn-primary mt-4 mb-4' disabled={isSubmitting}>
          {isSubmitting ? labels.submitPending : labels.submitIdle}
        </button>

        <p className='text-center'>
          {labels.haveAccount}{' '}
          <Link href='/auth/login' className='link link-hover'>
            {labels.signIn}
          </Link>
        </p>
        <p className='text-center'>
          <span className='opacity-70'>{labels.passwordResetSoon}</span>
        </p>
      </fieldset>
    </form>
  );
}
