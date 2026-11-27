import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiClient } from "../../../../lib/apiClient";
import { deferred } from "../../../../test/deferred";
import { testUser } from "../../../../test/fixtures";
import { renderRoutes } from "../../../../test/renderRoutes";
import { employeesKey } from "../../api/employeesKey";
import { positionsQuery } from "../../api/useGetPositions";
import type { Position } from "../../types";
import { DeletePosition } from "./DeletePosition";

const kitchen: Position = { id: 1, name: "Küche", colour: "yellow" };
const service: Position = { id: 2, name: "Service", colour: "red" };

const del = vi.spyOn(apiClient, "delete");

afterEach(() => {
  del.mockReset();
});

/**
 * What the browser does for Escape in a modal <dialog> (jsdom doesn't): it
 * fires "cancel" and closes the dialog unless that event was prevented.
 */
function pressEscape() {
  const dialog = screen.getByRole<HTMLDialogElement>("dialog");
  const cancel = new Event("cancel", { cancelable: true });
  fireEvent(dialog, cancel);
  if (!cancel.defaultPrevented) dialog.close();
}

function setup() {
  const onClose = vi.fn();
  const view = renderRoutes(
    [{ path: "/", element: <DeletePosition position={kitchen} onClose={onClose} /> }],
    { user: testUser },
  );
  view.queryClient.setQueryData(positionsQuery.queryKey, [kitchen, service]);
  return {
    ...view,
    onClose,
    user: userEvent.setup(),
    input: screen.getByLabelText('Type "Küche" to confirm'),
    confirm: screen.getByRole("button", { name: "Delete position" }),
  };
}

describe("DeletePosition", () => {
  it("is a modal window that warns what gets deleted", () => {
    setup();

    const dialog = screen.getByRole<HTMLDialogElement>("dialog", { name: "Delete Küche?" });
    // Opened with showModal(): the browser then traps Tab and makes the page inert.
    expect(dialog.tagName).toBe("DIALOG");
    expect(dialog.open).toBe(true);
    expect(dialog).toHaveAccessibleDescription(
      /removes it from every employee who has it/,
    );
  });

  it("stays open in StrictMode, which opens, closes and reopens it in development", async () => {
    const onClose = vi.fn();
    renderRoutes(
      [
        {
          path: "/",
          element: (
            <StrictMode>
              <DeletePosition position={kitchen} onClose={onClose} />
            </StrictMode>
          ),
        },
      ],
      { user: testUser },
    );

    // Long enough for the "close" event of the first, thrown-away open.
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(screen.getByRole<HTMLDialogElement>("dialog").open).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("starts with the name input focused and the delete button disabled", () => {
    const { input, confirm } = setup();

    expect(input).toHaveFocus();
    expect(confirm).toBeDisabled();
  });

  it.each(["Küch", "küche", "Service"])(
    "keeps the delete button disabled for the wrong name %s",
    async (typed) => {
      const { user, input, confirm } = setup();

      await user.type(input, `${typed}{Enter}`);

      expect(confirm).toBeDisabled();
      expect(del).not.toHaveBeenCalled();
    },
  );

  it("deletes the position once its name is typed, then closes", async () => {
    del.mockResolvedValue(null);
    const { user, input, confirm, onClose, queryClient } = setup();

    await user.type(input, "Küche");
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    expect(del).toHaveBeenCalledWith("/positions/1");
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    // Gone from the cached list, the other position stays.
    expect(queryClient.getQueryData(positionsQuery.queryKey)).toEqual([service]);
  });

  it("marks the cached employee lists as stale, since they show the position", async () => {
    del.mockResolvedValue(null);
    const { user, input, queryClient } = setup();
    queryClient.setQueryData([...employeesKey, 5], []);

    await user.type(input, "Küche{Enter}");

    await vi.waitFor(() =>
      expect(queryClient.getQueryState([...employeesKey, 5])?.isInvalidated).toBe(true),
    );
  });

  it("can be confirmed with Enter", async () => {
    del.mockResolvedValue(null);
    const { user, input } = setup();

    await user.type(input, "Küche{Enter}");

    expect(del).toHaveBeenCalledWith("/positions/1");
  });

  it("closes without deleting on Cancel", async () => {
    const { user, input, onClose } = setup();
    await user.type(input, "Küche");

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(del).not.toHaveBeenCalled();
  });

  it("closes without deleting on Escape", async () => {
    const { onClose } = setup();

    pressEscape();

    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(del).not.toHaveBeenCalled();
  });

  it("closes without deleting on a click on the backdrop, but not on a click inside", async () => {
    const { user, onClose } = setup();

    await user.click(screen.getByRole("heading", { name: "Delete Küche?" }));
    expect(onClose).not.toHaveBeenCalled();

    // The <dialog> element itself is only hit on the backdrop around the panel.
    await user.click(screen.getByRole("dialog"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(del).not.toHaveBeenCalled();
  });

  it("stays open and disabled while the request is running", async () => {
    const request = deferred<null>();
    del.mockReturnValue(request.promise);
    const { user, input, onClose } = setup();

    await user.type(input, "Küche{Enter}");

    expect(await screen.findByRole("button", { name: "Deleting …" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    pressEscape();
    await user.click(screen.getByRole("dialog")); // the backdrop
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole<HTMLDialogElement>("dialog").open).toBe(true);

    request.resolve(null);
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("shows the server's message when deleting fails and stays open", async () => {
    del.mockRejectedValue(new ApiError(500, "Internal server error"));
    const { user, input, onClose, queryClient } = setup();

    await user.type(input, "Küche{Enter}");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn't delete the position");
    expect(alert).toHaveTextContent("Internal server error");
    expect(onClose).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(positionsQuery.queryKey)).toEqual([kitchen, service]);
  });
});
