import api from '../../../lib/api';
import { RegisterFormData, LoginFormData, ForgotPasswordFormData } from '../types/form.types';

export const registerUser = (data: RegisterFormData) => {
  return api.post('/auth/register', data);
};

export const loginUser = async (data: LoginFormData) => {
  const res = await api.post("/auth/login", data);
  return res.data;
};
export const forgotPassword = (data: ForgotPasswordFormData) => {
  return api.post('/auth/forgot-password', data);
};
