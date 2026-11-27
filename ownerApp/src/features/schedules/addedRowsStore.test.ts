import { afterEach, describe, expect, it } from "vitest";
import { useAddedRowsStore } from "./addedRowsStore";

const { add, remove } = useAddedRowsStore.getState();
const rows = () => useAddedRowsStore.getState().rows;

afterEach(() => {
  useAddedRowsStore.setState({ rows: {} });
});

describe("addedRowsStore", () => {
  it("keeps the rows per restaurant and week, in the order they were added", () => {
    add(1, "2026-11-16", { employeeId: 7, positionId: 1 });
    add(1, "2026-11-16", { employeeId: 8, positionId: 2 });
    add(2, "2026-11-16", { employeeId: 7, positionId: 3 });
    add(1, "2026-11-23", { employeeId: 9, positionId: 1 });

    expect(rows()).toEqual({
      "1:2026-11-16": [
        { employeeId: 7, positionId: 1 },
        { employeeId: 8, positionId: 2 },
      ],
      "2:2026-11-16": [{ employeeId: 7, positionId: 3 }],
      "1:2026-11-23": [{ employeeId: 9, positionId: 1 }],
    });
  });

  it("adds a person to a zone only once, but to several zones", () => {
    add(1, "2026-11-16", { employeeId: 7, positionId: 1 });
    const before = rows();
    add(1, "2026-11-16", { employeeId: 7, positionId: 1 });
    expect(rows()).toBe(before); // nothing changed, so nothing re-renders

    add(1, "2026-11-16", { employeeId: 7, positionId: 3 });
    expect(rows()["1:2026-11-16"]).toEqual([
      { employeeId: 7, positionId: 1 },
      { employeeId: 7, positionId: 3 },
    ]);
  });

  it("removes one row and leaves the others", () => {
    add(1, "2026-11-16", { employeeId: 7, positionId: 1 });
    add(1, "2026-11-16", { employeeId: 7, positionId: 3 });
    add(1, "2026-11-23", { employeeId: 7, positionId: 1 });

    remove(1, "2026-11-16", { employeeId: 7, positionId: 1 });

    expect(rows()).toEqual({
      "1:2026-11-16": [{ employeeId: 7, positionId: 3 }],
      "1:2026-11-23": [{ employeeId: 7, positionId: 1 }],
    });
  });
});
