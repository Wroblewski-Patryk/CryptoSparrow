import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string()
    .regex(/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/,{ message: "Podaj poprawny email" }),
  password: z.string().min(6, { message: "Hasło musi mieć min. 6 znaków" }),
  terms: z.boolean().refine(val => val, {
    message: 'Musisz zaakceptować regulamin',
  }),
});

export const loginSchema = z.object({
  email: z.string().regex(
    /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/,
    { message: "Podaj poprawny email" }
  ),
  password: z.string().min(6, { message: "Hasło musi mieć min. 6 znaków" })
    .regex(/[a-z]/, { message: "Hasło musi zawierać małą literę" })
    .regex(/[A-Z]/, { message: "Hasło musi zawierać wielką literę" })
    .regex(/[0-9]/, { message: "Hasło musi zawierać cyfrę" })
    .regex(/[^a-zA-Z0-9]/, { message: "Hasło musi zawierać znak specjalny" }),
  remember: z.boolean().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string()
    .regex(/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/,{ message: "Podaj poprawny email" }),
});


export type RegisterFormData = z.infer<typeof registerSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
