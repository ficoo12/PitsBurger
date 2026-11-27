import type { RouteObject } from "react-router";
import { describe, expect, it } from "vitest";
import { routes } from "./router";

/** Every route in the tree that loads its page on demand. */
function lazyRoutes(list: RouteObject[]): RouteObject[] {
  return list.flatMap((route) => [
    ...(route.lazy ? [route] : []),
    ...lazyRoutes(route.children ?? []),
  ]);
}

describe("routes", () => {
  it("loads every page on demand", () => {
    // Login, schedule, and the three positions pages (this excerpt's routes).
    expect(lazyRoutes(routes)).toHaveLength(5);
  });

  it("resolves every lazy route to a page component", async () => {
    for (const route of lazyRoutes(routes)) {
      if (typeof route.lazy !== "function") throw new Error(`${route.path}: lazy is not a function`);
      const { Component } = await route.lazy();
      expect(Component, route.path).toBeTypeOf("function");
    }
  });
});
