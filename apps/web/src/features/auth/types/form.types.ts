import { z } from 'zod';

export const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: 'Podaj poprawny email' }),
  password: z
    .string()
    .min(8, { message: 'Haslo musi miec min. 8 znakow' })
    .regex(/[A-Za-z]/, { message: 'Haslo musi zawierac co najmniej jedna litere' })
    .regex(/\d/, { message: 'Haslo musi zawierac co najmniej jedna cyfre' }),
  terms: z.boolean().refine(val => val, {
    message: 'Musisz zaakceptowac regulamin',
  }),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: 'Podaj poprawny email' }),
  // Login validates presence only; password complexity belongs to registration.
  password: z.string().min(1, { message: 'Podaj haslo' }),
  remember: z.boolean().optional(),
});

export type RegisterFormData = z.infer<typeof registerSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;
