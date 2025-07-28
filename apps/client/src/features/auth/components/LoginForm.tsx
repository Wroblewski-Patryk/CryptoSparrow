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
    <form onSubmit={onFormSubmit} className="w-full max-w-md p-6 rounded-xl shadow space-y-6 bg-white dark:bg-gray-900">
      <h1 className="text-2xl font-bold text-center">Sign In</h1>

      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium">Email</label>
        <input
          id="email"
          type="email"
          placeholder="name@example.com"
          disabled={isSubmitting}
          {...register("email")}
          className={`w-full px-4 py-2 border rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.email ? "border-red-500" : "border-gray-300"
          }`}
        />
        {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm font-medium">Password</label>
        <input
          id="password"
          type="password"
          placeholder="********"
          disabled={isSubmitting}
          {...register("password")}
          className={`w-full px-4 py-2 border rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.password ? "border-red-500" : "border-gray-300"
          }`}
        />
        {errors.password && <p className="text-sm text-red-600">{errors.password.message}</p>}
      </div>

      <div className="flex items-center gap-2">
        <input
          id="remember"
          type="checkbox"
          {...register("remember")}
          className="mt-1"
          disabled={isSubmitting}
        />
        <label htmlFor="remember" className="text-sm text-gray-700 dark:text-gray-300">
          Remember me
        </label>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition disabled:opacity-50"
      >
        {isSubmitting ? "Logging in..." : "Log In"}
      </button>

      <p className="text-center text-sm text-gray-500">
        Don’t have an account?{" "}
        <Link href="/auth/register" className="text-blue-600 hover:underline">
          Sign up
        </Link>
      </p>
    </form>
  );
}
