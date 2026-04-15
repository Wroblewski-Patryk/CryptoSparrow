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

export const useRegisterForm = () => {
  const router = useRouter();
  const { refetchUser } = useAuth();

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
        throw new Error('Nie udalo sie potwierdzic sesji po rejestracji. Sprobuj zalogowac sie ponownie.');
      }

      toast.success('Rejestracja zakonczona sukcesem.');
      navigateWithFallback(router, {
        href: '/dashboard',
        mode: 'replace',
        fallbackPrefix: '/auth/register',
      });
    } catch (err) {
      toast.error(`Rejestracja nieudana: ${handleError(err)}`);
    }
  };

  const onFormSubmit = handleSubmit(submitHandler);
  return { register, onFormSubmit, errors, isSubmitting };
};
