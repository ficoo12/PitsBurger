import { apiClient } from "../../../lib/apiClient";
import type { DismissAvailabilityInput } from "../types";

/** Hides one day's availability hint without giving a shift (POST /availability/dismiss). */
export async function dismissAvailability(input: DismissAvailabilityInput): Promise<void> {
  await apiClient.post<void>("/availability/dismiss", input);
}
