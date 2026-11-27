import { apiClient } from "../../../lib/apiClient";
import type { LoginInput, User } from "../types";

export async function login(input: LoginInput): Promise<User> {
  return (await apiClient.post<{ user: User }>("/auth/login", input)).user;
}
