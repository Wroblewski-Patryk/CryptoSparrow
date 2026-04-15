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

export const useLoginForm = () => {
  const router = useRouter();
  const { refetchUser } = useAuth();
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
        throw new Error('Nie udalo sie potwierdzic sesji. Sprobuj zalogowac sie ponownie.');
      }

      toast.success('Zalogowano pomyslnie.');
      navigateWithFallback(router, {
        href: '/dashboard',
        mode: 'replace',
        fallbackPrefix: '/auth/login',
      });
    } catch (err) {
      const fallbackMessage = 'Logowanie nieudane. Sprawdz dane i sprobuj ponownie.';
      const message = handleError(err) || fallbackMessage;
      setServerError(message);
      toast.error(`Logowanie nieudane: ${message}`);
    }
  };

  const onFormSubmit = handleSubmit(submitHandler);
  return { register, onFormSubmit, errors, isSubmitting, serverError };
};
