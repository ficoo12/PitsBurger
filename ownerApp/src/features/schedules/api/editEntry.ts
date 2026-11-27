import { apiClient } from "../../../lib/apiClient";
import type { EditEntryInput, ScheduleEntry } from "../types";

/** Replaces the shift in a saved cell (PUT /schedules/entries/:id). */
export async function editEntry(id: number, input: EditEntryInput): Promise<ScheduleEntry> {
  return (await apiClient.put<{ entry: ScheduleEntry }>(`/schedules/entries/${id}`, input)).entry;
}
