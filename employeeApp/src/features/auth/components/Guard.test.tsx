import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RouteObject } from "react-router";
import { testEmployee } from "../../../test/fixtures";
import { renderRoutes } from "../../../test/renderRoutes";
import { Guard, RedirectHome } from "./Guard";

// The same layout as app/router.tsx, with placeholder pages.
const routes: RouteObject[] = [
  {
    element: <Guard zone="guest" />,
    children: [{ path: "/", element: <p>login page</p> }],
  },
  {
    element: <Guard zone="employee" />,
    children: [{ path: "/availability", element: <p>availability page</p> }],
  },
  { path: "*", element: <RedirectHome /> },
];

describe.each([
  { who: "a guest", user: null, home: "/", page: "login page", blocked: "/availability" },
  {
    who: "an employee",
    user: testEmployee,
    home: "/availability",
    page: "availability page",
    blocked: "/",
  },
])("$who", ({ user, home, page, blocked }) => {
  it(`can open ${home}`, () => {
    const { router } = renderRoutes(routes, { path: home, user });

    expect(router.state.location.pathname).toBe(home);
    expect(screen.getByText(page)).toBeInTheDocument();
  });

  it(`is sent from ${blocked} to ${home}`, () => {
    const { router } = renderRoutes(routes, { path: blocked, user });

    expect(router.state.location.pathname).toBe(home);
    expect(screen.getByText(page)).toBeInTheDocument();
  });

  it(`is sent from an unknown page to ${home}`, () => {
    const { router } = renderRoutes(routes, { path: "/no-such-page", user });

    expect(router.state.location.pathname).toBe(home);
  });
});
