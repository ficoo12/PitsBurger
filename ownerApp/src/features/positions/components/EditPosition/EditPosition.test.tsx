import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiClient } from "../../../../lib/apiClient";
import { deferred } from "../../../../test/deferred";
import { testUser } from "../../../../test/fixtures";
import { renderRoutes } from "../../../../test/renderRoutes";
import { employeesKey } from "../../api/employeesKey";
import { positionsQuery } from "../../api/useGetPositions";
import type { Position } from "../../types";
import { EditPosition } from "./EditPosition";

const kitchen: Position = { id: 1, name: "Küche", colour: "yellow" };
const service: Position = { id: 2, name: "Service", colour: "red" };

const get = vi.spyOn(apiClient, "get");
const put = vi.spyOn(apiClient, "put");

afterEach(() => {
  get.mockReset();
  put.mockReset();
});

/** Opens the edit page for the position with this id and waits for it to load. */
async function setup(id: number | string = 1, positions: Position[] = [kitchen, service]) {
  get.mockResolvedValue({ positions });
  const view = renderRoutes(
    [
      { path: "/dashboard/positions", element: <p>position list</p> },
      { path: "/dashboard/positions/:id/edit", element: <EditPosition /> },
    ],
    { path: `/dashboard/positions/${id}/edit`, user: testUser },
  );
  await screen.findByRole("heading", { name: "Edit position" });
  return { ...view, user: userEvent.setup() };
}

describe("EditPosition", () => {
  it("fills the form with the position's name", async () => {
    await setup();

    expect(await screen.findByLabelText("Name")).toHaveValue("Küche");
    expect(get).toHaveBeenCalledWith("/positions");
  });

  it("goes back to the list of positions with the back button", async () => {
    const { user, router } = await setup();

    await user.click(screen.getByRole("link", { name: /Back to positions/ }));

    expect(router.state.location.pathname).toBe("/dashboard/positions");
    expect(put).not.toHaveBeenCalled();
  });

  it.each(["999", "abc"])("says the position wasn't found for id %s", async (id) => {
    await setup(id);

    expect(await screen.findByRole("alert")).toHaveTextContent("Position not found");
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to positions/ })).toBeInTheDocument();
  });

  it("shows the error when the positions can't be loaded", async () => {
    get.mockRejectedValue(new ApiError(500, "Internal server error"));
    renderRoutes([{ path: "/dashboard/positions/:id/edit", element: <EditPosition /> }], {
      path: "/dashboard/positions/1/edit",
      user: testUser,
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load the position");
  });

  it("keeps the form and what was typed when a refresh in the background fails", async () => {
    const { user, queryClient } = await setup();
    const name = await screen.findByLabelText("Name");
    await user.clear(name);
    await user.type(name, "Kasse");

    // What a refetch on window focus does while the server is down.
    get.mockRejectedValue(new ApiError(500, "Internal server error"));
    await act(() => queryClient.refetchQueries({ queryKey: positionsQuery.queryKey }));

    expect(queryClient.getQueryState(positionsQuery.queryKey)?.status).toBe("error");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Kasse");
  });

  describe("saving", () => {
    it("puts the trimmed name, then returns to the list", async () => {
      const renamed: Position = { ...kitchen, name: "Kasse" };
      put.mockResolvedValue({ position: renamed });
      const { user, router } = await setup();
      const name = await screen.findByLabelText("Name");

      await user.clear(name);
      await user.type(name, "  Kasse ");
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      expect(put).toHaveBeenCalledWith("/positions/1", { name: "Kasse", colour: "yellow" });
      expect(await screen.findByText("position list")).toBeInTheDocument();
      expect(router.state.location.pathname).toBe("/dashboard/positions");
    });

    it("moves the renamed position to its place in the cached list and marks it stale", async () => {
      const renamed: Position = { ...kitchen, name: "Theke" };
      put.mockResolvedValue({ position: renamed });
      const { user, queryClient } = await setup();
      const name = await screen.findByLabelText("Name");
      // The page still shows the list when it is invalidated, so it is fetched
      // again right away. That request is held open to see the cache update alone.
      const refetch = deferred<{ positions: Position[] }>();
      get.mockReturnValue(refetch.promise);

      await user.clear(name);
      await user.type(name, "Theke");
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      await vi.waitFor(() =>
        expect(queryClient.getQueryData(positionsQuery.queryKey)).toEqual([service, renamed]),
      );
      expect(queryClient.getQueryState(positionsQuery.queryKey)?.isInvalidated).toBe(true);

      refetch.resolve({ positions: [service, renamed] });
      expect(await screen.findByText("position list")).toBeInTheDocument();
    });

    it("marks the cached employee lists as stale, since they show the old name", async () => {
      put.mockResolvedValue({ position: { ...kitchen, name: "Kasse" } });
      const { user, queryClient } = await setup();
      queryClient.setQueryData([...employeesKey, 5], []);
      const name = await screen.findByLabelText("Name");

      await user.clear(name);
      await user.type(name, "Kasse");
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      await screen.findByText("position list");
      expect(queryClient.getQueryState([...employeesKey, 5])?.isInvalidated).toBe(true);
    });

    it("offers its own colour and every free one, but not another position's", async () => {
      await setup();

      expect(await screen.findByRole("radio", { name: "Yellow" })).toBeChecked();
      expect(screen.getByRole("radio", { name: "Red, used by Service" })).toBeDisabled();
      expect(screen.getByRole("radio", { name: "Teal" })).toBeEnabled();
    });

    it("puts a new colour", async () => {
      put.mockResolvedValue({ position: { ...kitchen, colour: "teal" } });
      const { user } = await setup();

      await user.click(await screen.findByRole("radio", { name: "Teal" }));
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      expect(put).toHaveBeenCalledWith("/positions/1", { name: "Küche", colour: "teal" });
      expect(await screen.findByText("position list")).toBeInTheDocument();
    });

    it("sends nothing when the name is emptied", async () => {
      const { user } = await setup();
      const name = await screen.findByLabelText("Name");

      await user.clear(name);
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      expect(put).not.toHaveBeenCalled();
      expect(name).toHaveAccessibleDescription("Enter the position's name.");
    });

    it("disables the button while the request is running", async () => {
      const request = deferred<{ position: Position }>();
      put.mockReturnValue(request.promise);
      const { user } = await setup();

      await user.click(await screen.findByRole("button", { name: "Save changes" }));

      expect(await screen.findByRole("button", { name: "Saving …" })).toBeDisabled();
      request.resolve({ position: kitchen });
      await screen.findByText("position list");
    });

    it("shows a taken name under the input and stays on the form", async () => {
      put.mockRejectedValue(new ApiError(409, "A position with this name already exists"));
      const { user, router } = await setup();
      const name = await screen.findByLabelText("Name");

      await user.clear(name);
      await user.type(name, "Service");
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Please check the highlighted fields.",
      );
      expect(name).toHaveAccessibleDescription("A position with this name already exists");
      expect(router.state.location.pathname).toBe("/dashboard/positions/1/edit");
    });

    it("shows the server's message when saving fails and stays on the form", async () => {
      put.mockRejectedValue(new ApiError(404, "Position not found"));
      const { user, router } = await setup();

      await user.click(await screen.findByRole("button", { name: "Save changes" }));

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Couldn't save the position");
      expect(alert).toHaveTextContent("Position not found");
      expect(router.state.location.pathname).toBe("/dashboard/positions/1/edit");
    });
  });
});
