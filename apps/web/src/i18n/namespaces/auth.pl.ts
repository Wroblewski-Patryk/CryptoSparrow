export const authPl = {
  labels: {
    login: "Zaloguj sie",
    register: "Utworz konto",
  },
  page: {
    login: {
      title: "Zaloguj sie do Soar",
      description:
        "Przejdz do panelu i monitoruj rynek, pozycje oraz runtime botow w jednym miejscu.",
    },
    register: {
      title: "Utworz konto Soar",
      description:
        "Skonfiguruj konto, a potem testuj strategie, uruchamiaj boty i kontroluj ryzyko w jednym panelu.",
    },
  },
  forms: {
    common: {
      emailLabel: "Email",
      emailPlaceholder: "name@example.com",
      passwordLabel: "Haslo",
      passwordPlaceholder: "********",
      passwordResetSoon: "Reset hasla bedzie dostepny wkrotce.",
      showPassword: "Pokaz haslo",
      hidePassword: "Ukryj haslo",
    },
    login: {
      rememberDevice: "Zapamietaj to urzadzenie",
      submitIdle: "Zaloguj sie",
      submitPending: "Logowanie...",
      noAccount: "Nie masz konta?",
      createOne: "Utworz konto",
    },
    register: {
      agreePrefix: "Akceptuje",
      terms: "Regulamin",
      agreeMiddle: "oraz",
      privacy: "Polityke prywatnosci",
      submitIdle: "Utworz konto",
      submitPending: "Tworzenie konta...",
      haveAccount: "Masz konto?",
      signIn: "Zaloguj sie",
    },
  },
  toasts: {
    login: {
      sessionConfirmFailed: "Nie udalo sie potwierdzic sesji. Sprobuj zalogowac sie ponownie.",
      success: "Zalogowano pomyslnie.",
      failedFallback: "Logowanie nieudane. Sprawdz dane i sprobuj ponownie.",
      failedPrefix: "Logowanie nieudane:",
    },
    register: {
      sessionConfirmFailed: "Nie udalo sie potwierdzic sesji po rejestracji. Sprobuj zalogowac sie ponownie.",
      success: "Rejestracja zakonczona sukcesem.",
      failedFallback: "Rejestracja nieudana. Sprawdz dane i sprobuj ponownie.",
      failedPrefix: "Rejestracja nieudana:",
    },
  },
  validation: {
    emailInvalid: "Podaj poprawny email.",
    passwordRequired: "Podaj haslo.",
    passwordMin: "Haslo musi miec min. 8 znakow.",
    passwordLetter: "Haslo musi zawierac co najmniej jedna litere.",
    passwordDigit: "Haslo musi zawierac co najmniej jedna cyfre.",
    termsRequired: "Musisz zaakceptowac regulamin.",
  },
} as const;
