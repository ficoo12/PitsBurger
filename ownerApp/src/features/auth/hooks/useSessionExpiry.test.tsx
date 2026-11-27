import { useMutation, useQuery } from "@tanstack/react-query";
import { act, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ApiError } from "../../../lib/apiClient";
import { testUser } from "../../../test/fixtures";
import { renderHookWithClient } from "../../../test/renderRoutes";
import { sessionQuery } from "../api/useCurrentUser";
import type { User } from "../types";
import { useSessionExpiry } from "./useSessionExpiry";

const notSignedIn = new ApiError(401, "Not signed in");

/** Watches the session while a query fails with this error. */
function failQuery(error: unknown, user: User | null = testUser) {
  const view = renderHookWithClient(
    () => {
      useSessionExpiry();
      return useQuery({ queryKey: ["restaurants"], queryFn: () => Promise.reject(error) });
    },
    { user },
  );
  view.queryClient.setQueryData(["schedules", 7], { private: true });
  view.queryClient.setQueryData(["auth", "other"], { kept: true });
  return view;
}

describe("useSessionExpiry", () => {
  it("makes the user a guest when a query answers 401", async () => {
    const { queryClient } = failQuery(notSignedIn);

    await waitFor(() => expect(queryClient.getQueryData(sessionQuery.queryKey)).toBeNull());
  });

  it("throws away the user's cached data, but keeps auth queries", async () => {
    const { queryClient } = failQuery(notSignedIn);

    await waitFor(() => expect(queryClient.getQueryData(["schedules", 7])).toBeUndefined());
    expect(queryClient.getQueryData(["auth", "other"])).toEqual({ kept: true });
  });

  it("makes the user a guest when a mutation answers 401", async () => {
    const { result, queryClient } = renderHookWithClient(
      () => {
        useSessionExpiry();
        return useMutation({ mutationFn: () => Promise.reject(notSignedIn) });
      },
      { user: testUser },
    );

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toBe(notSignedIn);
    });

    expect(queryClient.getQueryData(sessionQuery.queryKey)).toBeNull();
  });

  it.each([
    ["a 403", new ApiError(403, "Only owners can do this")],
    ["a server error", new ApiError(500, "Internal server error")],
    ["an unreachable server", new ApiError(0, "Can't reach the server.")],
  ])("keeps the user and their data on %s", async (_label, error) => {
    const { result, queryClient } = failQuery(error);

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(queryClient.getQueryData(sessionQuery.queryKey)).toEqual(testUser);
    expect(queryClient.getQueryData(["schedules", 7])).toEqual({ private: true });
  });

  it("leaves a guest's data alone: their 401 (a wrong password) is not an expired session", async () => {
    const { result, queryClient } = failQuery(notSignedIn, null);

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(queryClient.getQueryData(["schedules", 7])).toEqual({ private: true });
  });
});
