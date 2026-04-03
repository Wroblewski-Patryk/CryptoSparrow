import api from '../../../lib/api';

export type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
};

export type DeleteAccountPayload = {
  password: string;
};

export async function changePassword(payload: ChangePasswordPayload): Promise<void> {
  await api.patch('/dashboard/profile/security/password', payload);
}

export async function deleteAccount(payload: DeleteAccountPayload): Promise<void> {
  await api.delete('/dashboard/profile/security/account', { data: payload });
}
