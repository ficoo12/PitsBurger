import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiClient } from "../../../lib/apiClient";
import type { ScheduleEntry } from "../types";
import { createEntry } from "./createEntry";
import { deleteEntry } from "./deleteEntry";
import { dismissAvailability } from "./dismissAvailability";
import { editEntry } from "./editEntry";

const entry: ScheduleEntry = {
  id: 5,
  employeeId: 7,
  workDate: "2026-11-17",
  shiftId: 2,
  startTime: "18:00",
  endTime: null,
  note: "181",
};
const input = { shiftId: 2, startTime: "18:00", endTime: null, note: "181" };

const post = vi.spyOn(apiClient, "post");
const put = vi.spyOn(apiClient, "put");
const remove = vi.spyOn(apiClient, "delete");

afterEach(() => {
  post.mockReset();
  put.mockReset();
  remove.mockReset();
});

describe("createEntry", () => {
  it("posts the cell and returns the saved entry", async () => {
    post.mockResolvedValue({ entry });
    const body = { ...input, employeeId: 7, restaurantId: 1, workDate: "2026-11-17" };

    expect(await createEntry(body)).toEqual(entry);
    expect(post).toHaveBeenCalledWith("/schedules/entries", body);
  });

  it("throws the ApiError when the request fails", async () => {
    const error = new ApiError(409, "This employee already works at Harbour on this day");
    post.mockRejectedValue(error);

    await expect(createEntry({ ...input, employeeId: 7, restaurantId: 1, workDate: "2026-11-17" })).rejects.toBe(error);
  });
});

describe("editEntry", () => {
  it("puts the cell by its id and returns the saved entry", async () => {
    put.mockResolvedValue({ entry });

    expect(await editEntry(5, input)).toEqual(entry);
    expect(put).toHaveBeenCalledWith("/schedules/entries/5", input);
  });
});

describe("deleteEntry", () => {
  it("deletes the cell by its id", async () => {
    remove.mockResolvedValue(null);

    await expect(deleteEntry(5)).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledWith("/schedules/entries/5");
  });
});

describe("dismissAvailability", () => {
  it("posts the person and the day", async () => {
    post.mockResolvedValue(null);

    await expect(dismissAvailability({ employeeId: 7, date: "2026-11-20" })).resolves.toBeUndefined();
    expect(post).toHaveBeenCalledWith("/availability/dismiss", { employeeId: 7, date: "2026-11-20" });
  });

  it("throws the ApiError when the request fails", async () => {
    const error = new ApiError(404, "Availability not found");
    post.mockRejectedValue(error);

    await expect(dismissAvailability({ employeeId: 7, date: "2026-11-20" })).rejects.toBe(error);
  });
});
