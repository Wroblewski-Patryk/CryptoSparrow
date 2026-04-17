import Link from 'next/link';
import { useState } from 'react';
import { useRegisterForm } from '../hooks/useRegisterForm';
import PasswordVisibilityToggle from './PasswordVisibilityToggle';
import { useI18n } from '@/i18n/I18nProvider';
import type { TranslationKey } from '@/i18n/translations';

export default function RegisterForm() {
  const { register, onFormSubmit, errors, isSubmitting } = useRegisterForm();
  const [showPassword, setShowPassword] = useState(false);
  const { t } = useI18n();
  const resolveFieldError = (value: unknown) =>
    typeof value === 'string' ? t(value as TranslationKey) : null;

  return (
    <form onSubmit={onFormSubmit} className='form' noValidate>
      <fieldset className='fieldset'>
        <label className='label' htmlFor='email'>
          {t('auth.forms.common.emailLabel')}
        </label>
        <input
          id='email'
          type='email'
          className={`input input-bordered w-full ${errors.email ? 'input-error' : ''}`}
          placeholder={t('auth.forms.common.emailPlaceholder')}
          disabled={isSubmitting}
          {...register('email')}
        />
        {errors.email && (
          <div className='text-error text-sm mt-1'>{resolveFieldError(errors.email.message)}</div>
        )}

        <label className='label' htmlFor='password'>
          {t('auth.forms.common.passwordLabel')}
        </label>
        <div className='join w-full'>
          <input
            id='password'
            type={showPassword ? 'text' : 'password'}
            className={`input input-bordered join-item w-full ${errors.password ? 'input-error' : ''}`}
            placeholder={t('auth.forms.common.passwordPlaceholder')}
            disabled={isSubmitting}
            {...register('password')}
          />
          <PasswordVisibilityToggle
            show={showPassword}
            disabled={isSubmitting}
            onToggle={() => setShowPassword((prev) => !prev)}
          />
        </div>
        {errors.password && (
          <div className='text-error text-sm mt-1'>{resolveFieldError(errors.password.message)}</div>
        )}

        <label htmlFor='terms' className='label'>
          <input id='terms' type='checkbox' className='checkbox mt-4 mr-1' disabled={isSubmitting} {...register('terms')} />
          <span className='pt-4'>
            {t('auth.forms.register.agreePrefix')}{' '}
            <Link href='/terms' className='link link-hover'>
              {t('auth.forms.register.terms')}
            </Link>{' '}
            {t('auth.forms.register.agreeMiddle')}{' '}
            <Link href='/privacy' className='link link-hover'>
              {t('auth.forms.register.privacy')}
            </Link>
          </span>
        </label>
        {errors.terms && (
          <div className='text-error text-sm mt-1'>{resolveFieldError(errors.terms.message)}</div>
        )}

        <button type='submit' className='btn btn-primary mt-4 mb-4' disabled={isSubmitting}>
          {isSubmitting ? t('auth.forms.register.submitPending') : t('auth.forms.register.submitIdle')}
        </button>

        <p className='text-center'>
          {t('auth.forms.register.haveAccount')}{' '}
          <Link href='/auth/login' className='link link-hover'>
            {t('auth.forms.register.signIn')}
          </Link>
        </p>
        <p className='text-center'>
          <span className='opacity-70'>{t('auth.forms.common.passwordResetSoon')}</span>
        </p>
      </fieldset>
    </form>
  );
}
