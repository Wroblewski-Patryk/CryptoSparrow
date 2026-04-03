import { z } from 'zod';

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(6),
    newPassword: z.string().min(6),
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    path: ['newPassword'],
    message: 'new password must be different from current password',
  });

export type ChangePasswordPayload = z.infer<typeof changePasswordSchema>;

export const deleteAccountSchema = z.object({
  password: z.string().min(6),
});

export type DeleteAccountPayload = z.infer<typeof deleteAccountSchema>;

