'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoginFormData, loginSchema } from '../types/form.types';
import { loginUser } from '../services/auth.service';
import { useRouter } from 'next/navigation';
import { handleError } from '../../../lib/handleError';
import { toast } from 'sonner';
import { useAuth } from '../../../context/AuthContext';

export const useLoginForm = () => {
  const router = useRouter();
  const { refetchUser } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onSubmit',
  });

  const submitHandler = async (data: LoginFormData) => {
    try {
      await loginUser(data);
      await refetchUser(); 

      toast.success("Zalogowano pomyślnie 🚀 Zostaniesz automatycznie przekierowany za sekundę.");

      setTimeout(() => {
        router.push('/dashboard');
      }, 1000);
    } catch (err) {
      toast.error(`Coś poszło nie tak 😢  ${handleError(err)}`);
    }
  };
  const onFormSubmit = handleSubmit(submitHandler);
  return { register, onFormSubmit, errors, isSubmitting };
};
