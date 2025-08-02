import Link from 'next/link';
import { useRegisterForm } from '../hooks/useRegisterForm';

export default function RegisterForm(){
  const {
    register,
    onFormSubmit,
    errors,
    isSubmitting
  } = useRegisterForm();
  
  return (
    <form onSubmit={onFormSubmit} className="form">
      <fieldset className="fieldset">
        <label 
          className="label" 
          htmlFor="email"
          >Email
        </label>
        <input 
          id="email" 
          type="email"
          className="input validator"
          placeholder="name@example.com" 
          disabled={isSubmitting} 
          {...register("email")} />
        {errors.email && <div className="validator-hint">{errors.email.message}</div>}
        
        <label 
          className="label"
          htmlFor="password"
          >Password
        </label>
        <input 
          id="password"
          type="password" 
          className="input validator" 
          placeholder="********"  
          disabled={isSubmitting}
          {...register("password")} />
        {errors.password && <div className="validator-hint">{errors.password.message}</div>}

        <label htmlFor="terms" className="label">
          <input
              id="terms"
              type="checkbox"
              className="checkbox mt-4 mr-1"
              disabled={isSubmitting}
              {...register("terms")}
            /> 
            <span className="pt-4">
              I accept the{' '}
              <Link href="/terms" className="text-blue-600 hover:underline">Terms of Service</Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>
            </span>
        </label>
        {errors.terms && (<div className="validator-hint">{errors.terms.message}</div>)}

        <button 
          type="submit"
          className="btn btn-neutral mt-4 mb-4"    
          disabled={isSubmitting}
          >{isSubmitting ? "Signing up..." : "Sign up"}
        </button>

        <p className="text-center">
          Have an account? {" "}
          <Link href="/auth/register" className="link link-hover">
            Sign up
          </Link>
        </p>
        <p className="text-center">
          <Link href="/auth/password" className="link link-hover">Forgot password?</Link>
        </p>
      </fieldset>

      {/* <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium">Email</label>
        <input
          id='email'
          type="email"
          placeholder="name@example.com"
          disabled={isSubmitting}
          {...register('email')}
          className={`w-full px-4 py-2 border rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.email ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.email && (
          <p className="text-sm text-red-600">{errors.email.message}</p>
        )}
      </div> */}

      {/* <div className="space-y-2">
        <label htmlFor="password" className="block text-sm font-medium">Password</label>
        <input
          id="password"
          type="password"
          placeholder="********"
          disabled={isSubmitting}
          {...register('password')}
          className={`w-full px-4 py-2 border rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.password ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        <p className="text-xs text-gray-500">Password must be at least 8 characters long</p>
        {errors.password && (
          <p className="text-sm text-red-600">{errors.password.message}</p>
        )}
      </div> */}

      {/* <div className="flex items-start gap-2">
        <input
          id="terms"
          type="checkbox"
          disabled={isSubmitting}
          {...register('terms')}
          className="mt-1"
        />
        <label htmlFor='terms' className="text-sm text-gray-700 dark:text-gray-300">
          I accept the{' '}
          <Link href="/terms" className="text-blue-600 hover:underline">Terms of Service</Link>{' '}
          and{' '}
          <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>
        </label>
      </div>
      {errors.terms && (
        <p className="text-sm text-red-600">{errors.terms.message}</p>
      )} */}

      {/* <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition disabled:opacity-50"
      >
        {isSubmitting ? 'Signing up...' : 'Sign Up'}
      </button> */}

      {/* <p className="text-center text-sm text-gray-500">
        Have an account?{' '}
        <Link href="/auth/login" className="text-blue-600 hover:underline">
          Log in
        </Link>
      </p> */}
    </form>
  );
}
