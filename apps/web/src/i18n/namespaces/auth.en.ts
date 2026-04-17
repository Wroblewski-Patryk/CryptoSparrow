export const authEn = {
  labels: {
    login: "Sign in",
    register: "Create account",
  },
  page: {
    login: {
      title: "Sign in to Soar",
      description:
        "Access your control center and monitor markets, positions, and bot runtime in one place.",
    },
    register: {
      title: "Create your Soar account",
      description:
        "Set up your account and start testing strategies, running bots, and tracking risk in one dashboard.",
    },
  },
  forms: {
    common: {
      emailLabel: "Email",
      emailPlaceholder: "name@example.com",
      passwordLabel: "Password",
      passwordPlaceholder: "********",
      passwordResetSoon: "Password reset will be available soon.",
      showPassword: "Show password",
      hidePassword: "Hide password",
    },
    login: {
      rememberDevice: "Remember this device",
      submitIdle: "Sign in",
      submitPending: "Signing in...",
      noAccount: "Don't have an account?",
      createOne: "Create one",
    },
    register: {
      agreePrefix: "I agree to the",
      terms: "Terms of Service",
      agreeMiddle: "and the",
      privacy: "Privacy Policy",
      submitIdle: "Create account",
      submitPending: "Creating account...",
      haveAccount: "Have an account?",
      signIn: "Sign in",
    },
  },
  toasts: {
    login: {
      sessionConfirmFailed: "Could not confirm session. Please sign in again.",
      success: "Signed in successfully.",
      failedFallback: "Sign-in failed. Check your credentials and try again.",
      failedPrefix: "Sign-in failed:",
    },
    register: {
      sessionConfirmFailed: "Could not confirm session after registration. Please sign in again.",
      success: "Registration completed successfully.",
      failedFallback: "Registration failed. Check your data and try again.",
      failedPrefix: "Registration failed:",
    },
  },
  validation: {
    emailInvalid: "Provide a valid email address.",
    passwordRequired: "Provide password.",
    passwordMin: "Password must have at least 8 characters.",
    passwordLetter: "Password must contain at least one letter.",
    passwordDigit: "Password must contain at least one digit.",
    termsRequired: "You must accept the terms.",
  },
} as const;
