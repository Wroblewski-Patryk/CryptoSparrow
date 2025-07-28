import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  terms: z.boolean().refine(val => val, {
    message: 'You must accept the terms and conditions',
  }),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6), 
  remember: z.boolean().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export type RegisterFormData = z.infer<typeof registerSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
