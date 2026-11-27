import { apiClient } from "../../../lib/apiClient";
import type { Position } from "../types";

/** The signed-in owner's positions, sorted by name (GET /positions). */
export async function getPositions(): Promise<Position[]> {
  return (await apiClient.get<{ positions: Position[] }>("/positions")).positions;
}
