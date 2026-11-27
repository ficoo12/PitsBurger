import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiClient } from "../../../lib/apiClient";
import { testEmployee } from "../../../test/fixtures";
import { renderHookWithClient } from "../../../test/renderRoutes";
import { sessionQuery } from "./useCurrentUser";
import { useLogout } from "./useLogout";

const post = vi.spyOn(apiClient, "post");

afterEach(() => {
  post.mockReset();
});

describe("useLogout", () => {
  it("posts to /employees/logout", async () => {
    post.mockResolvedValue(null);
    const { result } = renderHookWithClient(() => useLogout(), { user: testEmployee });

    await act(() => result.current.mutateAsync());

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith("/employees/logout");
  });

  it("sets the session to guest", async () => {
    post.mockResolvedValue(null);
    const { result, queryClient } = renderHookWithClient(() => useLogout(), {
      user: testEmployee,
    });

    await act(() => result.current.mutateAsync());

    expect(queryClient.getQueryData(sessionQuery.queryKey)).toBeNull();
  });

  it("throws away the previous employee's cached data, but keeps auth queries", async () => {
    post.mockResolvedValue(null);
    const { result, queryClient } = renderHookWithClient(() => useLogout(), {
      user: testEmployee,
    });
    queryClient.setQueryData(["availability", 7], { private: true });
    queryClient.setQueryData(["auth", "something"], { kept: true });

    await act(() => result.current.mutateAsync());

    expect(queryClient.getQueryData(["availability", 7])).toBeUndefined();
    expect(queryClient.getQueryData(["auth", "something"])).toEqual({ kept: true });
  });

  it("keeps the employee and their data when the request fails", async () => {
    const error = new ApiError(0, "Can't reach the server.");
    post.mockRejectedValue(error);
    const { result, queryClient } = renderHookWithClient(() => useLogout(), {
      user: testEmployee,
    });
    queryClient.setQueryData(["availability", 7], { private: true });

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toBe(error);
    });

    expect(queryClient.getQueryData(sessionQuery.queryKey)).toEqual(testEmployee);
    expect(queryClient.getQueryData(["availability", 7])).toEqual({ private: true });
  });
});
