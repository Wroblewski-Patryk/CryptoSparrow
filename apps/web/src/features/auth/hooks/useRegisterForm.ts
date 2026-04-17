'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RegisterFormData, registerSchema } from '../types/form.types';
import { registerUser } from '../services/auth.service';
import { useRouter } from 'next/navigation';
import { handleError } from '../../../lib/handleError';
import { toast } from 'sonner';
import { useAuth } from '../../../context/AuthContext';
import { navigateWithFallback } from '@/lib/navigation';
import { I18nContext } from '@/i18n/I18nProvider';
import { useContext } from 'react';

export const useRegisterForm = () => {
  const router = useRouter();
  const { refetchUser } = useAuth();
  const i18n = useContext(I18nContext);
  const locale = i18n?.locale ?? 'pl';
  const copy = {
    en: {
      sessionConfirmFailed: 'Could not confirm session after registration. Please sign in again.',
      registerSuccess: 'Registration completed successfully.',
      registerFailedPrefix: 'Registration failed:',
    },
    pl: {
      sessionConfirmFailed: 'Nie udalo sie potwierdzic sesji po rejestracji. Sprobuj zalogowac sie ponownie.',
      registerSuccess: 'Rejestracja zakonczona sukcesem.',
      registerFailedPrefix: 'Rejestracja nieudana:',
    },
    pt: {
      sessionConfirmFailed: 'Nao foi possivel confirmar sessao apos registo. Tenta entrar novamente.',
      registerSuccess: 'Registo concluido com sucesso.',
      registerFailedPrefix: 'Registo falhou:',
    },
  } as const;
  const labels = copy[locale];

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    mode: 'onTouched',
  });

  const submitHandler = async (data: RegisterFormData) => {
    try {
      await registerUser(data);
      const hasActiveSession = await refetchUser();
      if (!hasActiveSession) {
        throw new Error(labels.sessionConfirmFailed);
      }

      toast.success(labels.registerSuccess);
      navigateWithFallback(router, {
        href: '/dashboard',
        mode: 'replace',
        fallbackPrefix: '/auth/register',
      });
    } catch (err) {
      toast.error(`${labels.registerFailedPrefix} ${handleError(err)}`);
    }
  };

  const onFormSubmit = handleSubmit(submitHandler);
  return { register, onFormSubmit, errors, isSubmitting };
};
