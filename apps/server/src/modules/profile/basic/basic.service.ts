import { prisma } from '../../../prisma/client';
import { UpdateUserPayload } from './basic.types';

export const getUser = async (id: string) => {
  return prisma.user.findUnique({ where: { id } });
};

export const updateUser = async (id: string, data: UpdateUserPayload) => {
  return prisma.user.update({ where: { id }, data });
};
export const deleteUser = async (id: string) => {
  return prisma.user.delete({ where: { id } });
};
