import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { createMemoryRouter, RouterProvider, type RouteObject } from "react-router";
import { sessionQuery } from "../features/auth/api/useCurrentUser";
import type { User } from "../features/auth/types";

type Session = {
  /**
   * Who is signed in: a user, or null for a guest. Leave it out to keep the
   * session unanswered, so the test decides what GET /employees/me returns.
   */
  user?: User | null;
};

/**
 * A query client for one test, so tests never share cached data.
 * Failed queries aren't retried, so errors show up at once.
 */
export function createTestQueryClient(user?: User | null) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  if (user !== undefined) queryClient.setQueryData(sessionQuery.queryKey, user);
  return queryClient;
}

/** Renders routes the way the app does: inside a router and a query client. */
export function renderRoutes(
  routes: RouteObject[],
  { path = "/", user }: Session & { /** The URL the test starts on. */ path?: string } = {},
) {
  const queryClient = createTestQueryClient(user);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...view, router, queryClient };
}

/** Runs a hook that needs the query client, without any page around it. */
export function renderHookWithClient<T>(hook: () => T, { user }: Session = {}) {
  const queryClient = createTestQueryClient(user);
  const view = renderHook(hook, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
  return { ...view, queryClient };
}
