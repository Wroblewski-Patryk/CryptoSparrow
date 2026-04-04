import { z } from 'zod';
import { StrongPasswordSchema } from '../../auth/auth.types';

export const changePasswordSchema = z
  .object({
    // Current password must validate presence only to avoid locking users with legacy weak passwords.
    currentPassword: z.string().min(1, { message: 'current password is required' }),
    newPassword: StrongPasswordSchema,
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    path: ['newPassword'],
    message: 'new password must be different from current password',
  });

export type ChangePasswordPayload = z.infer<typeof changePasswordSchema>;

export const deleteAccountSchema = z.object({
  // Delete flow validates the existing credential, so only presence is required.
  password: z.string().min(1, { message: 'password is required' }),
});

export type DeleteAccountPayload = z.infer<typeof deleteAccountSchema>;
