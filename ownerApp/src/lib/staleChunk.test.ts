import { afterEach, describe, expect, it, vi } from "vitest";
import { isStaleChunkError, reloadOnce } from "./staleChunk";

describe("isStaleChunkError", () => {
  it.each([
    "Failed to fetch dynamically imported module: https://example.com/assets/EmployeesPage-abc.js",
    "error loading dynamically imported module: https://example.com/assets/EmployeesPage-abc.js",
    "Importing a module script failed.",
  ])("recognises %s", (message) => {
    expect(isStaleChunkError(new TypeError(message))).toBe(true);
  });

  it("ignores other errors", () => {
    expect(isStaleChunkError(new Error("Cannot read properties of undefined"))).toBe(false);
    expect(isStaleChunkError("Importing a module script failed.")).toBe(false);
    expect(isStaleChunkError(undefined)).toBe(false);
  });
});

describe("reloadOnce", () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("reloads the first time", () => {
    const reload = vi.fn();

    expect(reloadOnce(reload, 1_000_000)).toBe(true);
    expect(reload).toHaveBeenCalledOnce();
  });

  it("doesn't reload again within 10 seconds", () => {
    const reload = vi.fn();
    reloadOnce(reload, 1_000_000);

    expect(reloadOnce(reload, 1_009_999)).toBe(false);
    expect(reload).toHaveBeenCalledOnce();
  });

  it("reloads again after 10 seconds", () => {
    const reload = vi.fn();
    reloadOnce(reload, 1_000_000);

    expect(reloadOnce(reload, 1_010_000)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("doesn't reload without session storage, so it can't loop", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    const reload = vi.fn();

    expect(reloadOnce(reload, 1_000_000)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
