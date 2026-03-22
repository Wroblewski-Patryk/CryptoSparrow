import api from "../../../lib/api";
import type { User } from "../types/user.type";

// Pobierz profil usera
export async function fetchBasic(): Promise<User> {
  const res = await api.get<User>("/dashboard/profile/basic");
  return res.data;
}

// Aktualizuj profil usera
export async function updateBasic(data: Partial<User>): Promise<User> {
  const res = await api.patch<User>("/dashboard/profile/basic", data);
  return res.data;
}
