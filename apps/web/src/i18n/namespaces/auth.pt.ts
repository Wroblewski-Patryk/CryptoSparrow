export const authPt = {
  labels: {
    login: "Entrar",
    register: "Criar conta",
  },
  page: {
    login: {
      title: "Entrar no Soar",
      description:
        "Acede ao centro de controlo e monitoriza mercados, posicoes e runtime dos bots num so lugar.",
    },
    register: {
      title: "Criar conta Soar",
      description:
        "Configura a tua conta e comeca a testar estrategias, correr bots e controlar risco num so painel.",
    },
  },
  forms: {
    common: {
      emailLabel: "Email",
      emailPlaceholder: "name@example.com",
      passwordLabel: "Password",
      passwordPlaceholder: "********",
      passwordResetSoon: "Reset de password disponivel em breve.",
      showPassword: "Mostrar password",
      hidePassword: "Esconder password",
    },
    login: {
      rememberDevice: "Lembrar este dispositivo",
      submitIdle: "Entrar",
      submitPending: "A entrar...",
      noAccount: "Nao tens conta?",
      createOne: "Criar conta",
    },
    register: {
      agreePrefix: "Concordo com os",
      terms: "Termos de Servico",
      agreeMiddle: "e com a",
      privacy: "Politica de Privacidade",
      submitIdle: "Criar conta",
      submitPending: "A criar conta...",
      haveAccount: "Ja tens conta?",
      signIn: "Entrar",
    },
  },
  toasts: {
    login: {
      sessionConfirmFailed: "Nao foi possivel confirmar sessao. Tenta entrar novamente.",
      success: "Sessao iniciada com sucesso.",
      failedFallback: "Falha no login. Verifica os dados e tenta novamente.",
      failedPrefix: "Falha no login:",
    },
    register: {
      sessionConfirmFailed: "Nao foi possivel confirmar sessao apos registo. Tenta entrar novamente.",
      success: "Registo concluido com sucesso.",
      failedFallback: "Registo falhou. Verifica os dados e tenta novamente.",
      failedPrefix: "Registo falhou:",
    },
  },
  validation: {
    emailInvalid: "Indica um email valido.",
    passwordRequired: "Indica a password.",
    passwordMin: "A password deve ter pelo menos 8 caracteres.",
    passwordLetter: "A password deve conter pelo menos uma letra.",
    passwordDigit: "A password deve conter pelo menos um digito.",
    termsRequired: "Tens de aceitar os termos.",
  },
} as const;
