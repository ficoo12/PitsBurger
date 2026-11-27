import { ApiError, apiClient } from "../../../lib/apiClient";
import type { User } from "../types";

export async function getCurrentUser(): Promise<User | null> {
  try {
    return (await apiClient.get<{ user: User }>("/auth/me")).user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}
