import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiClient } from "../../../lib/apiClient";
import type { Schedule } from "../types";
import { getSchedule } from "./getSchedule";

const schedule: Schedule = {
  restaurantId: 3,
  weekStart: "2026-11-16",
  entries: [
    {
      id: 1,
      employeeId: 7,
      workDate: "2026-11-16",
      shiftId: 2,
      startTime: "18:00",
      endTime: null,
      note: "181",
    },
  ],
  availability: [{ employeeId: 7, note: "Car 181", days: [{ date: "2026-11-18", shiftId: 1 }] }],
};

const get = vi.spyOn(apiClient, "get");

afterEach(() => {
  get.mockReset();
});

describe("getSchedule", () => {
  it("asks for one restaurant's week and returns its schedule", async () => {
    get.mockResolvedValue({ schedule });

    expect(await getSchedule(3, "2026-11-16")).toEqual(schedule);
    expect(get).toHaveBeenCalledWith("/schedules?restaurantId=3&weekStart=2026-11-16");
  });

  it("throws the ApiError when the request fails", async () => {
    const error = new ApiError(404, "Restaurant not found");
    get.mockRejectedValue(error);

    await expect(getSchedule(3, "2026-11-16")).rejects.toBe(error);
  });
});
