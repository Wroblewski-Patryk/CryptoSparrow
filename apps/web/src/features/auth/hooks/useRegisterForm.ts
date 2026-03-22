'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RegisterFormData, registerSchema } from '../types/form.types';
import { registerUser } from '../services/auth.service';
import { useRouter } from 'next/navigation';
import { handleError } from '../../../lib/handleError';
import { toast } from 'sonner';
import { useAuth } from '../../../context/AuthContext';

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
      await refetchUser();

      toast.success("Rejestracja zakończona sukcesem 🎉 Zostaniesz automatycznie przekierowany za sekundę.");

      setTimeout(() => {
        router.push('/dashboard');
      }, 1000);
    } catch (err) {
      toast.error(`Coś poszło nie tak 😢 ${handleError(err)}`);
    }
  };
  const onFormSubmit = handleSubmit(submitHandler);
  return { register, onFormSubmit, errors, isSubmitting };
};
