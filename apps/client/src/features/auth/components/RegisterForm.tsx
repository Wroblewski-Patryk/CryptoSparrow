import Link from 'next/link';
import { useRegisterForm } from '../hooks/useRegisterForm';

export default function RegisterForm() {
  const { register, onFormSubmit, errors, isSubmitting } = useRegisterForm();

  return (
    <form onSubmit={onFormSubmit} className='form'>
      <fieldset className='fieldset'>
        <label className='label' htmlFor='email'>
          Email
        </label>
        <input
          id='email'
          type='email'
          className={`input input-bordered ${errors.email ? 'input-error' : ''}`}
          placeholder='name@example.com'
          disabled={isSubmitting}
          {...register('email')}
        />
        {errors.email && <div className='text-error text-sm mt-1'>{errors.email.message}</div>}

        <label className='label' htmlFor='password'>
          Password
        </label>
        <input
          id='password'
          type='password'
          className={`input input-bordered ${errors.password ? 'input-error' : ''}`}
          placeholder='********'
          disabled={isSubmitting}
          {...register('password')}
        />
        {errors.password && <div className='text-error text-sm mt-1'>{errors.password.message}</div>}

        <label htmlFor='terms' className='label'>
          <input id='terms' type='checkbox' className='checkbox mt-4 mr-1' disabled={isSubmitting} {...register('terms')} />
          <span className='pt-4'>
            I accept the{' '}
            <Link href='/terms' className='text-blue-600 hover:underline'>
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href='/privacy' className='text-blue-600 hover:underline'>
              Privacy Policy
            </Link>
          </span>
        </label>
        {errors.terms && <div className='text-error text-sm mt-1'>{errors.terms.message}</div>}

        <button type='submit' className='btn btn-neutral mt-4 mb-4' disabled={isSubmitting}>
          {isSubmitting ? 'Signing up...' : 'Sign up'}
        </button>

        <p className='text-center'>
          Have an account?{' '}
          <Link href='/auth/login' className='link link-hover'>
            Log in
          </Link>
        </p>
        <p className='text-center'>
          <span className='opacity-70'>Password reset will be available after MVP.</span>
        </p>
      </fieldset>
    </form>
  );
}
