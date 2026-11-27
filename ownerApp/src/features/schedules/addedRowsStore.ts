import { create } from "zustand";

/** A person the owner put into one zone (a position) of a restaurant's week. */
export type AddedRow = { employeeId: number; positionId: number };

type AddedRowsState = {
  /** By `${restaurantId}:${weekStart}`, in the order they were added. */
  rows: Record<string, AddedRow[]>;
  /** Adds the row under the zone's others. Someone already in that zone isn't added twice. */
  add: (restaurantId: number, weekStart: string, row: AddedRow) => void;
  remove: (restaurantId: number, weekStart: string, row: AddedRow) => void;
};

function weekKey(restaurantId: number, weekStart: string) {
  return `${restaurantId}:${weekStart}`;
}

function sameRow(a: AddedRow, b: AddedRow) {
  return a.employeeId === b.employeeId && a.positionId === b.positionId;
}

/**
 * The rows the owner added to a week that have no saved shift yet. Client
 * state only, kept in memory: a row with a saved shift comes from the server
 * instead, and a reload forgets the rest.
 */
export const useAddedRowsStore = create<AddedRowsState>()((set) => ({
  rows: {},
  add: (restaurantId, weekStart, row) =>
    set((state) => {
      const key = weekKey(restaurantId, weekStart);
      const current = state.rows[key] ?? [];
      if (current.some((item) => sameRow(item, row))) return state;
      return { rows: { ...state.rows, [key]: [...current, row] } };
    }),
  remove: (restaurantId, weekStart, row) =>
    set((state) => {
      const key = weekKey(restaurantId, weekStart);
      const current = state.rows[key] ?? [];
      if (!current.some((item) => sameRow(item, row))) return state;
      return { rows: { ...state.rows, [key]: current.filter((item) => !sameRow(item, row)) } };
    }),
}));

/** The same empty list every time, so a week without added rows never causes a re-render. */
const NONE: AddedRow[] = [];

/** One restaurant's added rows for one week. Re-renders only when that list changes. */
export function useAddedRows(restaurantId: number, weekStart: string): AddedRow[] {
  return useAddedRowsStore((state) => state.rows[weekKey(restaurantId, weekStart)] ?? NONE);
}
