import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Navigate, type RouteObject } from "react-router";
import { apiClient } from "../../../lib/apiClient";
import { testUser } from "../../../test/fixtures";
import { renderRoutes } from "../../../test/renderRoutes";
import { DashboardLayout } from "./DashboardLayout";

// The dashboard part of app/router.tsx, with placeholder pages.
const routes: RouteObject[] = [
  {
    path: "/dashboard",
    element: <DashboardLayout />,
    children: [
      { index: true, element: <Navigate to="schedule" replace /> },
      { path: "schedule", element: <p>schedule page</p> },
      { path: "positions", element: <p>positions page</p> },
    ],
  },
];

describe("DashboardLayout", () => {
  it("opens the schedule page from /dashboard", () => {
    const { router } = renderRoutes(routes, { path: "/dashboard", user: testUser });

    expect(router.state.location.pathname).toBe("/dashboard/schedule");
    expect(screen.getByText("schedule page")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Schedule" })).toHaveAttribute("aria-current", "page");
  });

  it("shows the user's name in the sidebar", () => {
    renderRoutes(routes, { path: "/dashboard", user: testUser });

    expect(screen.getByText("Ana Horvat")).toBeInTheDocument();
  });

  it("shows the email for a user without a name", () => {
    renderRoutes(routes, {
      path: "/dashboard",
      user: { ...testUser, firstName: null, lastName: null },
    });

    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
  });

  it("shows only the part of the name that is there", () => {
    renderRoutes(routes, { path: "/dashboard", user: { ...testUser, lastName: null } });

    expect(screen.getByText("Ana")).toBeInTheDocument();
  });

  it("lists the main links in order", () => {
    renderRoutes(routes, { path: "/dashboard", user: testUser });

    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Schedule",
      "Positions",
    ]);
    expect(screen.getByRole("link", { name: "Positions" })).toHaveAttribute(
      "href",
      "/dashboard/positions",
    );
  });

  it("shows a decorative icon in every main link", () => {
    renderRoutes(routes, { path: "/dashboard", user: testUser });

    const nav = screen.getByRole("navigation", { name: "Main" });
    for (const link of within(nav).getAllByRole("link")) {
      expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("switches to the positions page from the sidebar", async () => {
    const { router } = renderRoutes(routes, { path: "/dashboard/schedule", user: testUser });

    await userEvent.click(screen.getByRole("link", { name: "Positions" }));

    expect(router.state.location.pathname).toBe("/dashboard/positions");
    expect(screen.getByText("positions page")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Positions" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Schedule" })).not.toHaveAttribute("aria-current");
  });

  describe("menu on small screens", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("opens the main links in a drawer", async () => {
      renderRoutes(routes, { path: "/dashboard/schedule", user: testUser });
      const menuButton = screen.getByRole("button", { name: "Open menu" });
      expect(menuButton).toHaveAttribute("aria-expanded", "false");

      await userEvent.click(menuButton);

      const drawer = screen.getByRole("dialog", { name: "Menu" });
      const nav = within(drawer).getByRole("navigation", { name: "Main" });
      expect(within(nav).getAllByRole("link")).toHaveLength(2);
      expect(within(drawer).getByText("Ana Horvat")).toBeInTheDocument();
      expect(menuButton).toHaveAttribute("aria-expanded", "true");
    });

    it("goes to the clicked page and closes", async () => {
      const { router } = renderRoutes(routes, { path: "/dashboard/schedule", user: testUser });
      await userEvent.click(screen.getByRole("button", { name: "Open menu" }));

      const drawer = screen.getByRole("dialog", { name: "Menu" });
      await userEvent.click(within(drawer).getByRole("link", { name: "Positions" }));

      expect(router.state.location.pathname).toBe("/dashboard/positions");
      expect(screen.getByText("positions page")).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    });

    it("closes with its close button", async () => {
      renderRoutes(routes, { path: "/dashboard/schedule", user: testUser });
      await userEvent.click(screen.getByRole("button", { name: "Open menu" }));

      await userEvent.click(screen.getByRole("button", { name: "Close menu" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(screen.getByText("schedule page")).toBeInTheDocument();
    });

    it("logs out from the drawer", async () => {
      const post = vi.spyOn(apiClient, "post").mockResolvedValue(null);
      renderRoutes(routes, { path: "/dashboard/schedule", user: testUser });
      await userEvent.click(screen.getByRole("button", { name: "Open menu" }));

      const drawer = screen.getByRole("dialog", { name: "Menu" });
      await userEvent.click(within(drawer).getByRole("button", { name: "Log out" }));

      expect(post).toHaveBeenCalledWith("/auth/logout");
    });
  });
});
