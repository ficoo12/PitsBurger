import { apiClient } from "../../../lib/apiClient";
import type { AvailabilityWeek } from "../types";

export async function getAvailability(): Promise<AvailabilityWeek> {
  return (await apiClient.get<{ availability: AvailabilityWeek }>("/availability")).availability;
}
