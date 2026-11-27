import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RouteObject } from "react-router";
import { ApiError, apiClient } from "../../../lib/apiClient";
import { deferred } from "../../../test/deferred";
import { testEmployee } from "../../../test/fixtures";
import { renderRoutes } from "../../../test/renderRoutes";
import { sessionQuery } from "../api/useCurrentUser";
import type { User } from "../types";
import { AuthBootstrap } from "./AuthBootstrap";

const get = vi.spyOn(apiClient, "get");

afterEach(() => {
  get.mockReset();
});

const routes: RouteObject[] = [
  { element: <AuthBootstrap />, children: [{ path: "/", element: <p>the app</p> }] },
];

describe("AuthBootstrap", () => {
  it("shows a spinner and holds the app back until /employees/me has answered", async () => {
    const me = deferred<{ user: User }>();
    get.mockReturnValue(me.promise);

    renderRoutes(routes);

    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    expect(screen.queryByText("the app")).not.toBeInTheDocument();
    expect(get).toHaveBeenCalledWith("/employees/me");

    me.resolve({ user: testEmployee });
    expect(await screen.findByText("the app")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows the app to a signed-in user", async () => {
    get.mockResolvedValue({ user: testEmployee });

    const { queryClient } = renderRoutes(routes);

    expect(await screen.findByText("the app")).toBeInTheDocument();
    expect(queryClient.getQueryData(sessionQuery.queryKey)).toEqual(testEmployee);
  });

  it("shows the app to a guest: a 401 is an answer, not a failure", async () => {
    get.mockRejectedValue(new ApiError(401, "Not signed in"));

    const { queryClient } = renderRoutes(routes);

    expect(await screen.findByText("the app")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(queryClient.getQueryData(sessionQuery.queryKey)).toBeNull();
  });

  it("asks nothing when the session is known already", () => {
    renderRoutes(routes, { user: testEmployee });

    expect(screen.getByText("the app")).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });

  describe("when the first check fails", () => {
    it("shows the error and a retry button instead of the app", async () => {
      get.mockRejectedValue(new ApiError(0, "Can't reach the server."));

      renderRoutes(routes);

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Connection failed");
      expect(alert).toHaveTextContent("Can't reach the server.");
      expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
      expect(screen.queryByText("the app")).not.toBeInTheDocument();
    });

    it("checks again with Try again, and shows the app when that works", async () => {
      get.mockRejectedValueOnce(new ApiError(500, "Internal server error"));
      const second = deferred<{ user: User }>();
      get.mockReturnValueOnce(second.promise);
      const user = userEvent.setup();

      renderRoutes(routes);
      await user.click(await screen.findByRole("button", { name: "Try again" }));

      // Back to the spinner while the retry is running, so it can't be clicked twice.
      expect(screen.getByRole("status")).toHaveTextContent("Loading");
      expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
      expect(get).toHaveBeenCalledTimes(2);

      second.resolve({ user: testEmployee });
      expect(await screen.findByText("the app")).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("stays on the error when the retry fails too", async () => {
      get.mockRejectedValue(new ApiError(500, "Internal server error"));
      const user = userEvent.setup();

      renderRoutes(routes);
      await user.click(await screen.findByRole("button", { name: "Try again" }));

      expect(await screen.findByRole("button", { name: "Try again" })).toBeEnabled();
      expect(screen.getByRole("alert")).toHaveTextContent("Internal server error");
      expect(screen.queryByText("the app")).not.toBeInTheDocument();
    });
  });

  it("keeps the app and the user when a later refresh fails", async () => {
    get.mockRejectedValue(new ApiError(500, "Internal server error"));
    const { queryClient } = renderRoutes(routes, { user: testEmployee });

    await queryClient.refetchQueries({ queryKey: sessionQuery.queryKey });

    expect(get).toHaveBeenCalledTimes(1);
    expect(screen.getByText("the app")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(queryClient.getQueryData(sessionQuery.queryKey)).toEqual(testEmployee);
  });
});
