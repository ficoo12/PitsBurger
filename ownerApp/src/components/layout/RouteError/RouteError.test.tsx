import { screen } from "@testing-library/react";
import type { RouteObject } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testUser } from "../../../test/fixtures";
import { renderRoutes } from "../../../test/renderRoutes";
import { DashboardLayout } from "../DashboardLayout/DashboardLayout";
import { RouteError } from "./RouteError";

function Broken(): never {
  throw new Error("Cannot read properties of undefined");
}

/** What a browser throws for a page chunk an older deploy had. */
function StaleChunk(): never {
  throw new TypeError("Failed to fetch dynamically imported module: /assets/ShiftsPage-old.js");
}

// The error levels of app/router.tsx, with placeholder pages.
const routes: RouteObject[] = [
  {
    errorElement: <RouteError fullScreen />,
    children: [
      { path: "/login", element: <Broken /> },
      {
        path: "/dashboard",
        element: <DashboardLayout />,
        children: [
          {
            errorElement: <RouteError />,
            children: [
              { path: "employees", element: <p>employees page</p> },
              { path: "schedule", element: <Broken /> },
              { path: "shifts", element: <StaleChunk /> },
            ],
          },
        ],
      },
    ],
  },
];

describe("RouteError", () => {
  beforeEach(() => {
    // React and the router log every error they catch.
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("shows a page's error beside the sidebar", () => {
    renderRoutes(routes, { path: "/dashboard/schedule", user: testUser });

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.getByRole("button", { name: "Reload page" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
  });

  it("shows the error in development", () => {
    renderRoutes(routes, { path: "/dashboard/schedule", user: testUser });

    expect(screen.getByText("Cannot read properties of undefined")).toBeInTheDocument();
  });

  it("says a new version is there when a page chunk is still gone after the reload", () => {
    // The page reloaded for it a moment ago, so it doesn't reload again.
    sessionStorage.setItem("reloaded-for-stale-chunk-at", String(Date.now()));
    renderRoutes(routes, { path: "/dashboard/shifts", user: testUser });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "A new version of the app is available. Reload to get it.",
    );
    expect(screen.getByRole("button", { name: "Reload page" })).toBeInTheDocument();
  });

  it("leaves the other pages alone", () => {
    renderRoutes(routes, { path: "/dashboard/employees", user: testUser });

    expect(screen.getByText("employees page")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("uses the whole screen outside the dashboard", () => {
    renderRoutes(routes, { path: "/login", user: null });

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.queryByRole("navigation", { name: "Main" })).not.toBeInTheDocument();
  });
});
