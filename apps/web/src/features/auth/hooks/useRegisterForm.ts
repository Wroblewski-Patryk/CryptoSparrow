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
import { useI18n } from '@/i18n/I18nProvider';

export const useRegisterForm = () => {
  const router = useRouter();
  const { refetchUser } = useAuth();
  const { t } = useI18n();

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
        throw new Error(t('auth.toasts.register.sessionConfirmFailed'));
      }

      toast.success(t('auth.toasts.register.success'));
      navigateWithFallback(router, {
        href: '/dashboard',
        mode: 'replace',
        fallbackPrefix: '/auth/register',
      });
    } catch (err) {
      const message = handleError(err) || t('auth.toasts.register.failedFallback');
      toast.error(`${t('auth.toasts.register.failedPrefix')} ${message}`);
    }
  };

  const onFormSubmit = handleSubmit(submitHandler);
  return { register, onFormSubmit, errors, isSubmitting };
};
