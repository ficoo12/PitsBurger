import { apiClient } from "../../../lib/apiClient";
import type { SubmitAvailabilityInput, SubmittedAvailability } from "../types";

export async function submitAvailability(
  input: SubmitAvailabilityInput,
): Promise<SubmittedAvailability> {
  return (
    await apiClient.post<{ availability: SubmittedAvailability }>("/availability", input)
  ).availability;
}
