import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiClient } from "../../../lib/apiClient";
import { testUser } from "../../../test/fixtures";
import { renderHookWithClient } from "../../../test/renderRoutes";
import { sessionQuery } from "./useCurrentUser";
import { useLogout } from "./useLogout";

const post = vi.spyOn(apiClient, "post");

afterEach(() => {
  post.mockReset();
});

describe("useLogout", () => {
  it("posts to /auth/logout", async () => {
    post.mockResolvedValue(null);
    const { result } = renderHookWithClient(() => useLogout(), { user: testUser });

    await act(() => result.current.mutateAsync());

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith("/auth/logout");
  });

  it("sets the session to guest", async () => {
    post.mockResolvedValue(null);
    const { result, queryClient } = renderHookWithClient(() => useLogout(), {
      user: testUser,
    });

    await act(() => result.current.mutateAsync());

    expect(queryClient.getQueryData(sessionQuery.queryKey)).toBeNull();
  });

  it("throws away the previous user's cached data, but keeps auth queries", async () => {
    post.mockResolvedValue(null);
    const { result, queryClient } = renderHookWithClient(() => useLogout(), {
      user: testUser,
    });
    queryClient.setQueryData(["schedules", 7], { private: true });
    queryClient.setQueryData(["restaurants"], [{ id: 1 }]);
    queryClient.setQueryData(["auth", "other"], { kept: true });

    await act(() => result.current.mutateAsync());

    expect(queryClient.getQueryData(["schedules", 7])).toBeUndefined();
    expect(queryClient.getQueryData(["restaurants"])).toBeUndefined();
    expect(queryClient.getQueryData(["auth", "other"])).toEqual({ kept: true });
  });

  it("keeps the user and their data when the request fails", async () => {
    const error = new ApiError(0, "Can't reach the server.");
    post.mockRejectedValue(error);
    const { result, queryClient } = renderHookWithClient(() => useLogout(), {
      user: testUser,
    });
    queryClient.setQueryData(["schedules", 7], { private: true });

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toBe(error);
    });

    expect(queryClient.getQueryData(sessionQuery.queryKey)).toEqual(testUser);
    expect(queryClient.getQueryData(["schedules", 7])).toEqual({ private: true });
  });
});
