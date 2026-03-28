type PasswordVisibilityToggleProps = {
  show: boolean;
  disabled?: boolean;
  onToggle: () => void;
};

export default function PasswordVisibilityToggle({ show, disabled = false, onToggle }: PasswordVisibilityToggleProps) {
  return (
    <button
      type="button"
      className="input input-bordered join-item flex w-12 items-center justify-center px-0"
      aria-label={show ? 'Hide password' : 'Show password'}
      onClick={onToggle}
      disabled={disabled}
    >
      {show ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58M9.88 5.09A10.94 10.94 0 0112 4c5.25 0 9.27 3.24 10.5 8-1 3.36-3.35 5.98-6.4 7.2M6.61 6.61C4.68 8 3.26 9.86 2.5 12a11.8 11.8 0 003.2 5"
          />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.5 12C3.73 7.24 7.75 4 13 4c5.25 0 9.27 3.24 10.5 8-1.23 4.76-5.25 8-10.5 8-5.25 0-9.27-3.24-10.5-8z"
          />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );
}
