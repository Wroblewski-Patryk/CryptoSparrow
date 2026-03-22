import bcrypt from 'bcrypt';

export const hashPassword = async (plain: string) => {
  return bcrypt.hash(plain, 10);
};

export const comparePassword = async (input: string, hashed: string) => {
  return await bcrypt.compare(input, hashed);
};