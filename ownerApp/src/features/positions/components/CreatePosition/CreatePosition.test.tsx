import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiClient } from "../../../../lib/apiClient";
import { PALETTE } from "../../../../lib/palette";
import { deferred } from "../../../../test/deferred";
import { testUser } from "../../../../test/fixtures";
import { renderRoutes } from "../../../../test/renderRoutes";
import { positionsQuery } from "../../api/useGetPositions";
import type { Position } from "../../types";
import { CreatePosition } from "./CreatePosition";

const created: Position = { id: 7, name: "Kasse", colour: "orange" };
const kitchen: Position = { id: 1, name: "Küche", colour: "yellow" };
const service: Position = { id: 2, name: "Service", colour: "red" };

const get = vi.spyOn(apiClient, "get");
const post = vi.spyOn(apiClient, "post");

afterEach(() => {
  get.mockReset();
  post.mockReset();
});

/** The page once the owner's positions have loaded. */
async function setup(positions: Position[] = [kitchen, service]) {
  get.mockResolvedValue({ positions });
  const view = renderRoutes(
    [
      { path: "/dashboard/positions", element: <p>position list</p> },
      { path: "/dashboard/positions/new", element: <CreatePosition /> },
    ],
    { path: "/dashboard/positions/new", user: testUser },
  );
  return {
    ...view,
    user: userEvent.setup(),
    name: await screen.findByLabelText("Name"),
    submit: screen.getByRole("button", { name: "Create position" }),
  };
}

describe("CreatePosition", () => {
  it("goes back to the list of positions with the back button", async () => {
    const { user, router } = await setup();

    await user.click(screen.getByRole("link", { name: /Back to positions/ }));

    expect(router.state.location.pathname).toBe("/dashboard/positions");
    expect(post).not.toHaveBeenCalled();
  });

  it("sends nothing and marks the name when it is empty, and clears the error while typing", async () => {
    const { user, name, submit } = await setup();

    await user.click(submit);

    expect(post).not.toHaveBeenCalled();
    expect(name).toBeInvalid();
    expect(name).toHaveAccessibleDescription("Enter the position's name.");
    expect(name).toHaveFocus();

    await user.type(name, "Kasse");

    expect(name).toBeValid();
  });

  it("picks the next free colour and marks the others' colours as taken", async () => {
    await setup();

    expect(screen.getByRole("radio", { name: "Orange" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Red, used by Service" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "Yellow, used by Küche" })).toBeDisabled();
  });

  it("creates the position with its colour and returns to the list", async () => {
    post.mockResolvedValue({ position: created });
    const { user, name, submit, router } = await setup();

    await user.type(name, "  Kasse ");
    await user.click(screen.getByRole("radio", { name: "Teal" }));
    await user.click(submit);

    expect(post).toHaveBeenCalledWith("/positions", { name: "Kasse", colour: "teal" });
    expect(await screen.findByText("position list")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/dashboard/positions");
  });

  it("puts the new position in its place in a list that is already loaded", async () => {
    post.mockResolvedValue({ position: created });
    const { user, name, submit, queryClient } = await setup();
    // The page watches the list, so invalidating it fetches it again right
    // away. That request is held open to see the cache update alone.
    const refetch = deferred<{ positions: Position[] }>();
    get.mockReturnValue(refetch.promise);

    await user.type(name, "Kasse");
    await user.click(submit);

    await vi.waitFor(() =>
      expect(queryClient.getQueryData(positionsQuery.queryKey)).toEqual([
        created,
        kitchen,
        service,
      ]),
    );
    expect(queryClient.getQueryState(positionsQuery.queryKey)?.isInvalidated).toBe(true);

    refetch.resolve({ positions: [created, kitchen, service] });
    expect(await screen.findByText("position list")).toBeInTheDocument();
  });

  it("disables the button while the request is running", async () => {
    const request = deferred<{ position: Position }>();
    post.mockReturnValue(request.promise);
    const { user, name, submit } = await setup();

    await user.type(name, "Kasse");
    await user.click(submit);

    expect(await screen.findByRole("button", { name: "Creating …" })).toBeDisabled();
    request.resolve({ position: created });
    await screen.findByText("position list");
  });

  it("shows a taken name under the input and stays on the form", async () => {
    post.mockRejectedValue(new ApiError(409, "A position with this name already exists"));
    const { user, name, submit, router } = await setup();

    await user.type(name, "Service");
    await user.click(submit);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please check the highlighted fields.",
    );
    expect(name).toHaveAccessibleDescription("A position with this name already exists");
    expect(router.state.location.pathname).toBe("/dashboard/positions/new");
  });

  it("shows a colour taken in the meantime under the colours, not under the name", async () => {
    const message = "Another position already has this colour";
    post.mockRejectedValue(new ApiError(409, message, { colour: [message] }));
    const { user, name, submit } = await setup();

    await user.type(name, "Kasse");
    await user.click(submit);

    expect(await screen.findByRole("group", { name: "Colour" })).toHaveAccessibleDescription(
      message,
    );
    expect(name).not.toHaveAccessibleDescription(message);
  });

  it("can't create a position when every colour is taken", async () => {
    const all = PALETTE.map((colour, index) => ({ id: index + 1, name: `P${index}`, colour }));
    await setup(all);

    expect(screen.getByRole("group", { name: "Colour" })).toHaveAccessibleDescription(
      "All colours are taken. Delete a position or change its colour first.",
    );
    expect(screen.getByRole("button", { name: "Create position" })).toBeDisabled();
  });

  it("shows the server's message for other failures, and clears it on the next edit", async () => {
    post.mockRejectedValue(new ApiError(403, "Only owners can do this"));
    const { user, name, submit } = await setup();

    await user.type(name, "Kasse");
    await user.click(submit);

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't create the position");
    expect(screen.getByRole("alert")).toHaveTextContent("Only owners can do this");

    await user.type(name, "!");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
