/**
 * The drag data type of a person dragged from the add panel onto a zone. Only
 * a zone of the restaurant whose panel is open accepts it. While dragging, the
 * browser shows only the types, not the data, so the zone check uses the open
 * panel and the drop checks the data again.
 */
export const DRAG_TYPE = "application/x-pitsburger-employee";

export type DraggedEmployee = {
  employeeId: number;
  restaurantId: number;
  weekStart: string;
  /** The zone it is dragged for. */
  positionId: number;
};

/** The dragged person, or null when the drop carries something else. */
export function readDraggedEmployee(dataTransfer: DataTransfer): DraggedEmployee | null {
  try {
    const value: unknown = JSON.parse(dataTransfer.getData(DRAG_TYPE));
    if (typeof value !== "object" || value === null) return null;
    const { employeeId, restaurantId, weekStart, positionId } = value as Record<string, unknown>;
    if (
      typeof employeeId !== "number" ||
      typeof restaurantId !== "number" ||
      typeof weekStart !== "string" ||
      typeof positionId !== "number"
    ) {
      return null;
    }
    return { employeeId, restaurantId, weekStart, positionId };
  } catch {
    return null;
  }
}
