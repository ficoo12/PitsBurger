import { apiClient } from "../../../lib/apiClient";
import type { EditPositionInput, Position } from "../types";

/** Renames a position (PUT /positions/:id). */
export async function editPosition(id: number, input: EditPositionInput): Promise<Position> {
  return (await apiClient.put<{ position: Position }>(`/positions/${id}`, input)).position;
}
