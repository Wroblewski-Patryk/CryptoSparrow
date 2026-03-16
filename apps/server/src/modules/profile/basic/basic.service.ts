import { prisma } from '../../../prisma/client';
import { UpdateUserPayload } from './basic.types';
import { publicUserSelect } from '../../users/publicUser';

export const getUser = async (id: string) => {
  return prisma.user.findUnique({
    where: { id },
    select: publicUserSelect,
  });
};

export const updateUser = async (id: string, data: UpdateUserPayload) => {
  return prisma.user.update({
    where: { id },
    data,
    select: publicUserSelect,
  });
};
export const deleteUser = async (id: string) => {
  return prisma.user.delete({ where: { id } });
};
