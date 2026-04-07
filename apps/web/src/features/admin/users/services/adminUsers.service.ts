import api from "@/lib/api";
import { AdminUser, AdminUsersQuery, AdminUsersResponse, UpdateAdminUserPayload } from "../types/adminUser.type";

export const getAdminUsers = async (query: AdminUsersQuery = {}): Promise<AdminUsersResponse> => {
  const response = await api.get<AdminUsersResponse>("/admin/users", {
    params: {
      ...(query.search ? { search: query.search } : {}),
      ...(query.role ? { role: query.role } : {}),
      ...(query.page ? { page: query.page } : {}),
      ...(query.pageSize ? { pageSize: query.pageSize } : {}),
    },
  });

  return response.data;
};

export const updateAdminUser = async (userId: string, payload: UpdateAdminUserPayload): Promise<AdminUser> => {
  const response = await api.patch<AdminUser>(`/admin/users/${userId}`, payload);
  return response.data;
};

