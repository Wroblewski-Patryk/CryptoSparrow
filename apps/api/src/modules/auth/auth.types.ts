import { z } from 'zod';

export const StrongPasswordSchema = z
  .string()
  .min(8, { message: 'password must be at least 8 characters long' })
  .regex(/[A-Za-z]/, { message: 'password must include at least one letter' })
  .regex(/\d/, { message: 'password must include at least one number' });

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: StrongPasswordSchema,
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, { message: 'password is required' }),
  remember: z.boolean().optional(),
});

export type LoginInput = z.infer<typeof LoginSchema>;
