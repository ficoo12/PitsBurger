import { screen } from "@testing-library/react";
import type { RouteObject } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderRoutes } from "../../../test/renderRoutes";
import { RouteError } from "./RouteError";

function Broken(): never {
  throw new Error("Cannot read properties of undefined");
}

// The root of app/router.tsx, with a screen that crashes.
const routes: RouteObject[] = [
  {
    errorElement: <RouteError />,
    children: [
      { path: "/", element: <p>login screen</p> },
      { path: "/availability", element: <Broken /> },
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
    vi.restoreAllMocks();
  });

  it("shows a reload screen instead of a screen that crashed", () => {
    renderRoutes(routes, { path: "/availability", user: null });

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.getByRole("button", { name: "Reload page" })).toBeInTheDocument();
    expect(screen.getByText("Cannot read properties of undefined")).toBeInTheDocument();
  });

  it("leaves the other screens alone", () => {
    renderRoutes(routes, { path: "/", user: null });

    expect(screen.getByText("login screen")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });
});
