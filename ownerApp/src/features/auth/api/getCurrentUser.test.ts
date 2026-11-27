import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiClient } from "../../../lib/apiClient";
import type { User } from "../types";
import { getCurrentUser } from "./getCurrentUser";

const user: User = {
  id: 1,
  email: "ana@example.com",
  firstName: "Ana",
  lastName: "Horvat",
  username: null,
  role: "owner",
  avatarUrl: null,
  createdAt: "2026-11-07T21:48:43.781Z",
};

const get = vi.spyOn(apiClient, "get");

afterEach(() => {
  get.mockReset();
});

describe("getCurrentUser", () => {
  it("asks GET /auth/me and returns the user", async () => {
    get.mockResolvedValue({ user });

    expect(await getCurrentUser()).toEqual(user);
    expect(get).toHaveBeenCalledWith("/auth/me");
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
