import Link from 'next/link';
import { useState } from 'react';
import { useRegisterForm } from '../hooks/useRegisterForm';
import PasswordVisibilityToggle from './PasswordVisibilityToggle';

export default function RegisterForm() {
  const { register, onFormSubmit, errors, isSubmitting } = useRegisterForm();
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

        <label htmlFor='terms' className='label'>
          <input id='terms' type='checkbox' className='checkbox mt-4 mr-1' disabled={isSubmitting} {...register('terms')} />
          <span className='pt-4'>
            I agree to the{' '}
            <Link href='/terms' className='link link-hover'>
              Terms of Service
            </Link>{' '}
            and the{' '}
            <Link href='/privacy' className='link link-hover'>
              Privacy Policy
            </Link>
          </span>
        </label>
        {errors.terms && <div className='text-error text-sm mt-1'>{errors.terms.message}</div>}

        <button type='submit' className='btn btn-primary mt-4 mb-4' disabled={isSubmitting}>
          {isSubmitting ? 'Creating account...' : 'Create account'}
        </button>

        <p className='text-center'>
          Have an account?{' '}
          <Link href='/auth/login' className='link link-hover'>
            Sign in
          </Link>
        </p>
        <p className='text-center'>
          <span className='opacity-70'>Password reset will be available soon.</span>
        </p>
      </fieldset>
    </form>
  );
}
