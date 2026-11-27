import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiClient } from "../../../lib/apiClient";
import { testEmployee as user } from "../../../test/fixtures";
import { getCurrentUser } from "./getCurrentUser";

const get = vi.spyOn(apiClient, "get");

afterEach(() => {
  get.mockReset();
});

describe("getCurrentUser", () => {
  it("asks GET /employees/me and returns the user", async () => {
    get.mockResolvedValue({ user });

    expect(await getCurrentUser()).toEqual(user);
    expect(get).toHaveBeenCalledWith("/employees/me");
  });

  it("returns null for a 401: nobody is signed in", async () => {
    get.mockRejectedValue(new ApiError(401, "Not signed in"));

    expect(await getCurrentUser()).toBeNull();
  });

  it.each([
    ["a server error", new ApiError(500, "Internal server error")],
    ["another 4xx", new ApiError(403, "Forbidden")],
    ["an unreachable server", new ApiError(0, "Can't reach the server.")],
    ["an unexpected error", new Error("boom")],
  ])("throws on %s, so it isn't mistaken for signed out", async (_case, error) => {
    get.mockRejectedValue(error);

    await expect(getCurrentUser()).rejects.toBe(error);
  });
});
