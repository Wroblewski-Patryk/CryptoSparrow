'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoginFormData, loginSchema } from '../types/form.types';
import { loginUser } from '../services/auth.service';
import { useRouter } from 'next/navigation';
import { handleError } from '../../../lib/handleError';
import { toast } from 'sonner';
import { useAuth } from '../../../context/AuthContext';
import { navigateWithFallback } from '@/lib/navigation';
import { I18nContext } from '@/i18n/I18nProvider';
import { useContext } from 'react';

export const useLoginForm = () => {
  const router = useRouter();
  const { refetchUser } = useAuth();
  const i18n = useContext(I18nContext);
  const locale = i18n?.locale ?? 'pl';
  const copy = {
    en: {
      sessionConfirmFailed: 'Could not confirm session. Please sign in again.',
      loginSuccess: 'Signed in successfully.',
      loginFailedFallback: 'Sign-in failed. Check your credentials and try again.',
      loginFailedPrefix: 'Sign-in failed:',
    },
    pl: {
      sessionConfirmFailed: 'Nie udalo sie potwierdzic sesji. Sprobuj zalogowac sie ponownie.',
      loginSuccess: 'Zalogowano pomyslnie.',
      loginFailedFallback: 'Logowanie nieudane. Sprawdz dane i sprobuj ponownie.',
      loginFailedPrefix: 'Logowanie nieudane:',
    },
    pt: {
      sessionConfirmFailed: 'Nao foi possivel confirmar sessao. Tenta entrar novamente.',
      loginSuccess: 'Sessao iniciada com sucesso.',
      loginFailedFallback: 'Falha no login. Verifica os dados e tenta novamente.',
      loginFailedPrefix: 'Falha no login:',
    },
  } as const;
  const labels = copy[locale];
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onSubmit',
  });

  const submitHandler = async (data: LoginFormData) => {
    setServerError(null);
    try {
      await loginUser(data);
      const hasActiveSession = await refetchUser();
      if (!hasActiveSession) {
        throw new Error(labels.sessionConfirmFailed);
      }

      toast.success(labels.loginSuccess);
      navigateWithFallback(router, {
        href: '/dashboard',
        mode: 'replace',
        fallbackPrefix: '/auth/login',
      });
    } catch (err) {
      const fallbackMessage = labels.loginFailedFallback;
      const message = handleError(err) || fallbackMessage;
      setServerError(message);
      toast.error(`${labels.loginFailedPrefix} ${message}`);
    }
  };

  const onFormSubmit = handleSubmit(submitHandler);
  return { register, onFormSubmit, errors, isSubmitting, serverError };
};
