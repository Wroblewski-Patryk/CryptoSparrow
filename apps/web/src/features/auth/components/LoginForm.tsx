import Link from 'next/link';
import { useState } from 'react';
import { useLoginForm } from '../hooks/useLoginForm';
import PasswordVisibilityToggle from './PasswordVisibilityToggle';

export default function LoginForm() {
  const { register, onFormSubmit, errors, isSubmitting, serverError } = useLoginForm();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form onSubmit={onFormSubmit} className='form' noValidate>
      <fieldset className='fieldset'>
        <label className='label' htmlFor='email'>
          Email
        </label>
        <input
          id='email'
          type='email'
          className={`input input-bordered w-full ${errors.email ? 'input-error' : ''}`}
          placeholder='name@example.com'
          disabled={isSubmitting}
          {...register('email')}
        />
        {errors.email && <div className='text-error text-sm mt-1'>{errors.email.message}</div>}

        <label className='label' htmlFor='password'>
          Password
        </label>
        <div className='join w-full'>
          <input
            id='password'
            type={showPassword ? 'text' : 'password'}
            className={`input input-bordered join-item w-full ${errors.password ? 'input-error' : ''}`}
            placeholder='********'
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
          <span className='pt-4'>Remember me</span>
        </label>

        {serverError && <div className='alert alert-error mt-2 text-sm'>{serverError}</div>}

        <button type='submit' className='btn btn-neutral mt-4 mb-4' disabled={isSubmitting}>
          {isSubmitting ? 'Logging in...' : 'Log In'}
        </button>

        <p className='text-center'>
          Don&apos;t have an account?{' '}
          <Link href='/auth/register' className='link link-hover'>
            Sign up
          </Link>
        </p>
        <p className='text-center'>
          <span className='opacity-70'>Password reset will be available after MVP.</span>
        </p>
      </fieldset>
    </form>
  );
}
