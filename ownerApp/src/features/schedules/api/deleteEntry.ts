import { apiClient } from "../../../lib/apiClient";

/** Clears a saved cell (DELETE /schedules/entries/:id). */
export async function deleteEntry(id: number): Promise<void> {
  await apiClient.delete<void>(`/schedules/entries/${id}`);
}
