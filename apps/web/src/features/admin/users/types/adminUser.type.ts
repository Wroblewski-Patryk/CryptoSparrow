export type AdminUserRole = "USER" | "ADMIN";
export type AdminSubscriptionPlanCode = "FREE" | "ADVANCED" | "PROFESSIONAL";
export type AdminUserSubscriptionSource = "DEFAULT" | "ADMIN_OVERRIDE" | "CHECKOUT";

export type AdminUserActiveSubscription = {
  planCode: AdminSubscriptionPlanCode;
  planDisplayName: string;
  source: AdminUserSubscriptionSource;
  startsAt: string;
  endsAt: string | null;
};

export type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  role: AdminUserRole;
  createdAt: string;
  updatedAt: string;
  activeSubscription: AdminUserActiveSubscription | null;
};

export type AdminUsersResponse = {
  users: AdminUser[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type AdminUsersQuery = {
  search?: string;
  role?: AdminUserRole;
  page?: number;
  pageSize?: number;
};

export type UpdateAdminUserPayload = {
  role?: AdminUserRole;
  subscriptionPlanCode?: AdminSubscriptionPlanCode;
};

