import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiClient } from "../../../lib/apiClient";
import { testAvailabilityWeek } from "../../../test/fixtures";
import { getAvailability } from "./getAvailability";
import { submitAvailability } from "./submitAvailability";

const get = vi.spyOn(apiClient, "get");
const post = vi.spyOn(apiClient, "post");

afterEach(() => {
  get.mockReset();
  post.mockReset();
});

describe("getAvailability", () => {
  it("asks GET /availability and unwraps the week", async () => {
    get.mockResolvedValue({ availability: testAvailabilityWeek });

    expect(await getAvailability()).toEqual(testAvailabilityWeek);
    expect(get).toHaveBeenCalledWith("/availability");
  });

  it("passes an ApiError through", async () => {
    const error = new ApiError(403, "You can't submit availability");
    get.mockRejectedValue(error);

    await expect(getAvailability()).rejects.toBe(error);
  });
});

describe("submitAvailability", () => {
  const input = { days: [{ weekday: 1, shiftId: 7 }], note: "Only after 12" };
  const saved = { weekStart: "2026-11-30", ...input, savesLeft: 2 };

  it("posts the days and note to /availability and unwraps the result", async () => {
    post.mockResolvedValue({ availability: saved });

    expect(await submitAvailability(input)).toEqual(saved);
    expect(post).toHaveBeenCalledWith("/availability", input);
  });

  it("passes an ApiError through", async () => {
    const error = new ApiError(409, "You have no saves left this week");
    post.mockRejectedValue(error);

    await expect(submitAvailability(input)).rejects.toBe(error);
  });
});
