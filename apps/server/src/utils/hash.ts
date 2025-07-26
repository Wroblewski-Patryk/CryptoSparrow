import bcrypt from 'bcrypt';

export const hashPassword = async (plain: string) => {
  return bcrypt.hash(plain, 10);
};

export const verifyPassword = async (plain: string, hash: string) => {
  return bcrypt.compare(plain, hash);
};
