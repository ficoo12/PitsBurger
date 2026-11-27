import { createBrowserRouter, type RouteObject } from "react-router";
import { RouteError } from "../components/layout/RouteError/RouteError";
import { AuthBootstrap, Guard, RedirectHome } from "../features/auth";
import { AvailabilityPage } from "../pages/AvailabilityPage";
import { LoginPage } from "../pages/LoginPage";

// Every visitor belongs to one zone (see features/auth/zones.ts):
//   no employee session → guest    → /
//   employee session    → employee → /availability
// The paths are relative to the base path (vite.config.ts `base`), so in the
// browser they are /employee/ and /employee/availability.
export const routes: RouteObject[] = [
  {
    element: <AuthBootstrap />,
    // A screen that crashes shows this instead of the router's default error page.
    errorElement: <RouteError />,
    children: [
      {
        element: <Guard zone="guest" />,
        children: [{ path: "/", element: <LoginPage /> }],
      },
      {
        element: <Guard zone="employee" />,
        children: [{ path: "/availability", element: <AvailabilityPage /> }],
      },
      { path: "*", element: <RedirectHome /> },
    ],
  },
];

export const router = createBrowserRouter(routes, { basename: import.meta.env.BASE_URL });
