import api from "../../../lib/api";
import { ListOrdersQuery, Order } from "../types/order.type";

export const listOrders = async (query: ListOrdersQuery): Promise<Order[]> => {
  const res = await api.get<Order[]>("/dashboard/orders", { params: query });
  return res.data;
};

