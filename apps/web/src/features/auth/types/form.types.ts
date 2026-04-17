import { z } from 'zod';

export const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: 'auth.validation.emailInvalid' }),
  password: z
    .string()
    .min(8, { message: 'auth.validation.passwordMin' })
    .regex(/[A-Za-z]/, { message: 'auth.validation.passwordLetter' })
    .regex(/\d/, { message: 'auth.validation.passwordDigit' }),
  terms: z.boolean().refine(val => val, {
    message: 'auth.validation.termsRequired',
  }),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: 'auth.validation.emailInvalid' }),
  // Login validates presence only; password complexity belongs to registration.
  password: z.string().min(1, { message: 'auth.validation.passwordRequired' }),
  remember: z.boolean().optional(),
});

export type RegisterFormData = z.infer<typeof registerSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;
