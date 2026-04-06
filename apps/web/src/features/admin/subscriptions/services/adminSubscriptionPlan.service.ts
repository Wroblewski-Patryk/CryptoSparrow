import api from "@/lib/api";
import {
  AdminSubscriptionPlan,
  AdminSubscriptionPlanCode,
  AdminSubscriptionPlansResponse,
  UpdateAdminSubscriptionPlanPayload,
} from "../types/adminSubscriptionPlan.type";

export const getAdminSubscriptionPlans = async (): Promise<AdminSubscriptionPlan[]> => {
  const response = await api.get<AdminSubscriptionPlansResponse>("/admin/subscriptions/plans");
  return response.data.plans;
};

export const updateAdminSubscriptionPlan = async (
  code: AdminSubscriptionPlanCode,
  payload: UpdateAdminSubscriptionPlanPayload
): Promise<AdminSubscriptionPlan> => {
  const response = await api.put<AdminSubscriptionPlan>(`/admin/subscriptions/plans/${code}`, payload);
  return response.data;
};
