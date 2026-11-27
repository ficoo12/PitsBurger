import { apiClient } from "../../../lib/apiClient";
import type { CreateEntryInput, ScheduleEntry } from "../types";

/** Saves a shift in an empty cell (POST /schedules/entries). */
export async function createEntry(input: CreateEntryInput): Promise<ScheduleEntry> {
  return (await apiClient.post<{ entry: ScheduleEntry }>("/schedules/entries", input)).entry;
}
