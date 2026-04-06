import api from "../../../lib/api";
import { ProfileSubscriptionResponse } from "../types/subscription.type";

export const getProfileSubscription = async (): Promise<ProfileSubscriptionResponse> => {
  const response = await api.get<ProfileSubscriptionResponse>("/dashboard/profile/subscription");
  return response.data;
};

