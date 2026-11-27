import { apiClient } from "../../../lib/apiClient";
import type { Schedule } from "../types";

/**
 * One restaurant's schedule for one week
 * (GET /schedules?restaurantId=…&weekStart=…). `weekStart` must be a Monday.
 */
export async function getSchedule(restaurantId: number, weekStart: string): Promise<Schedule> {
  return (
    await apiClient.get<{ schedule: Schedule }>(
      `/schedules?restaurantId=${restaurantId}&weekStart=${weekStart}`,
    )
  ).schedule;
}
