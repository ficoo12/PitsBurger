import { createBrowserRouter, Navigate, type RouteObject } from "react-router";
import { CenterScreen } from "../components/layout/CenterScreen/CenterScreen";
import { DashboardLayout } from "../components/layout/DashboardLayout/DashboardLayout";
import { RouteError } from "../components/layout/RouteError/RouteError";
import { Spinner } from "../components/ui/Spinner/Spinner";
import { AuthBootstrap, Guard, RedirectHome } from "../features/auth";

// Every visitor belongs to one zone (see features/auth/zones.ts):
//   no session  → guest     → /login
//   signed in   → signedIn  → /dashboard
// There is no sign up: owner accounts are made with `npm run create-owner`
// in backend/.
//
// Every page is loaded on demand (route `lazy`), so the first download is only
// the app shell; each page's code, and libraries only it uses (Floating UI on
// the schedule), come in their own chunk the first time it is opened.
//
// Excerpt: the full app also has employees, restaurants, contracts, shifts and
// availability pages. Only the routes of the features in this repository are here.
export const routes: RouteObject[] = [
  {
    element: <AuthBootstrap />,
    // Anything that breaks outside the dashboard's pages: the whole screen.
    errorElement: <RouteError fullScreen />,
    // Shown while the first page's chunk downloads.
    hydrateFallbackElement: (
      <CenterScreen>
        <Spinner />
      </CenterScreen>
    ),
    children: [
      { path: "/", element: <RedirectHome /> },
      {
        element: <Guard zone="guest" />,
        children: [
          {
            path: "/login",
            lazy: async () => ({ Component: (await import("../pages/LoginPage")).LoginPage }),
          },
        ],
      },

      {
        element: <Guard zone="signedIn" />,
        children: [
          {
            path: "/dashboard",
            element: <DashboardLayout />,
            children: [
              // Errors inside a page show here, with the sidebar still around them.
              {
                errorElement: <RouteError />,
                children: [
                  { index: true, element: <Navigate to="schedule" replace /> },
                  {
                    path: "schedule",
                    lazy: async () => ({
                      Component: (await import("../pages/SchedulePage")).SchedulePage,
                    }),
                  },
                  {
                    path: "positions",
                    lazy: async () => ({
                      Component: (await import("../pages/PositionsPage")).PositionsPage,
                    }),
                  },
                  {
                    path: "positions/new",
                    lazy: async () => ({
                      Component: (await import("../pages/CreatePositionPage")).CreatePositionPage,
                    }),
                  },
                  {
                    path: "positions/:id/edit",
                    lazy: async () => ({
                      Component: (await import("../pages/EditPositionPage")).EditPositionPage,
                    }),
                  },
                ],
              },
            ],
          },
        ],
      },

      { path: "*", element: <RedirectHome /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
