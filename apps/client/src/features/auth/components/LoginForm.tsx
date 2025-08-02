import Link from "next/link";
import { useLoginForm } from "../hooks/useLoginForm";

export default function LoginForm() {
  const {
    register,
    onFormSubmit,
    errors,
    isSubmitting
  } = useLoginForm();

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
        
        <label htmlFor="remember" className="label">
          <input
              id="remember"
              type="checkbox"
              className="checkbox mt-4 mr-1"
              disabled={isSubmitting}
              {...register("remember")}
            /><span className="pt-4">Remember me</span>
        </label>
        
        <button 
          type="submit"
          className="btn btn-neutral mt-4 mb-4"    
          disabled={isSubmitting}
          >{isSubmitting ? "Logging in..." : "Log In"}
        </button>

        <p className="text-center">
          Don’t have an account?{" "}
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
