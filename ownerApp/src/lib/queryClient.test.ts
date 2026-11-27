import { describe, expect, it } from "vitest";
import { ApiError } from "./apiClient";
import { queryClient } from "./queryClient";

/** Whether a query that has failed `failureCount` times with `error` is tried again. */
function retries(failureCount: number, error: Error): boolean {
  const retry = queryClient.getDefaultOptions().queries?.retry;
  if (typeof retry !== "function") throw new Error("retry is not a function");
  return retry(failureCount, error);
}

describe("query retry rule", () => {
  it.each([
    ["an unreachable server", new ApiError(0, "Can't reach the server.")],
    ["a 500", new ApiError(500, "Internal server error")],
    ["a 503", new ApiError(503, "Service unavailable")],
    ["an unexpected error", new Error("boom")],
  ])("retries %s twice, then gives up", (_case, error) => {
    expect(retries(0, error)).toBe(true);
    expect(retries(1, error)).toBe(true);
    expect(retries(2, error)).toBe(false);
  });

  it.each([400, 401, 403, 404, 409, 429, 499])(
    "never retries a %i: asking again won't change it",
    (status) => {
      expect(retries(0, new ApiError(status, "nope"))).toBe(false);
    },
  );
});
