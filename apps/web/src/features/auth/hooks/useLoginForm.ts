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
import { useI18n } from '@/i18n/I18nProvider';

export const useLoginForm = () => {
  const router = useRouter();
  const { refetchUser } = useAuth();
  const { t } = useI18n();
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
        throw new Error(t('auth.toasts.login.sessionConfirmFailed'));
      }

      toast.success(t('auth.toasts.login.success'));
      navigateWithFallback(router, {
        href: '/dashboard',
        mode: 'replace',
        fallbackPrefix: '/auth/login',
      });
    } catch (err) {
      const fallbackMessage = t('auth.toasts.login.failedFallback');
      const message = handleError(err) || fallbackMessage;
      setServerError(message);
      toast.error(`${t('auth.toasts.login.failedPrefix')} ${message}`);
    }
  };

  const onFormSubmit = handleSubmit(submitHandler);
  return { register, onFormSubmit, errors, isSubmitting, serverError };
};
