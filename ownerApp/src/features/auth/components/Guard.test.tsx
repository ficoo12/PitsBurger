import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RouteObject } from "react-router";
import { testUser } from "../../../test/fixtures";
import { renderRoutes } from "../../../test/renderRoutes";
import type { User } from "../types";
import { Guard, RedirectHome } from "./Guard";

// The same layout as app/router.tsx, with placeholder pages.
const routes: RouteObject[] = [
  { path: "/", element: <RedirectHome /> },
  {
    element: <Guard zone="guest" />,
    children: [{ path: "/login", element: <p>login page</p> }],
  },
  {
    element: <Guard zone="signedIn" />,
    children: [{ path: "/dashboard", element: <p>dashboard page</p> }],
  },
  { path: "*", element: <RedirectHome /> },
];

const guest = null;
const owner: User = testUser;
/** An employee session from before the backend's login only let owners in. */
const employee: User = { ...testUser, role: "employee" };

describe.each([
  {
    who: "a guest",
    user: guest,
    home: "/login",
    allowed: ["/login"],
    blocked: ["/dashboard"],
  },
  {
    who: "a signed-in employee",
    user: employee,
    home: "/login",
    allowed: ["/login"],
    blocked: ["/dashboard"],
  },
  {
    who: "a signed-in owner",
    user: owner,
    home: "/dashboard",
    allowed: ["/dashboard"],
    blocked: ["/login"],
  },
])("$who", ({ user, home, allowed, blocked }) => {
  it.each(allowed)("can open %s", (path) => {
    const { router } = renderRoutes(routes, { path, user });

    expect(router.state.location.pathname).toBe(path);
    expect(screen.getByText(`${path.slice(1)} page`)).toBeInTheDocument();
  });

  it.each(blocked)(`is sent from %s to ${home}`, (path) => {
    const { router } = renderRoutes(routes, { path, user });

    expect(router.state.location.pathname).toBe(home);
    expect(screen.getByText(`${home.slice(1)} page`)).toBeInTheDocument();
    expect(screen.queryByText(`${path.slice(1)} page`)).not.toBeInTheDocument();
  });

  it.each(["/", "/no-such-page"])(`is sent from %s to ${home}`, (path) => {
    const { router } = renderRoutes(routes, { path, user });

    expect(router.state.location.pathname).toBe(home);
  });
});
