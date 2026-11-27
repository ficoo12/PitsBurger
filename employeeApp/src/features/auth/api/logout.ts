import { apiClient } from "../../../lib/apiClient";

export async function logout(): Promise<void> {
  return await apiClient.post<void>("/employees/logout");
}
