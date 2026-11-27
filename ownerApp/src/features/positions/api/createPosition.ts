import { apiClient } from "../../../lib/apiClient";
import type { CreatePositionInput, Position } from "../types";

/** Creates a position for the signed-in owner (POST /positions). */
export async function createPosition(input: CreatePositionInput): Promise<Position> {
  return (await apiClient.post<{ position: Position }>("/positions", input)).position;
}
