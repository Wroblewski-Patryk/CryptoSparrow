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
    </form>
  );
}
