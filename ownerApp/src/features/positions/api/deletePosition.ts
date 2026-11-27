import { apiClient } from "../../../lib/apiClient";

/**
 * Deletes a position (DELETE /positions/:id). Employees who had it keep their
 * other positions.
 */
export async function deletePosition(id: number): Promise<void> {
  await apiClient.delete<void>(`/positions/${id}`);
}
