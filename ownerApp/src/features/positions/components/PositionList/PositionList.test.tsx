import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiClient } from "../../../../lib/apiClient";
import { testUser } from "../../../../test/fixtures";
import { renderRoutes } from "../../../../test/renderRoutes";
import { positionsQuery } from "../../api/useGetPositions";
import type { Position } from "../../types";
import { PositionList } from "./PositionList";

const kitchen: Position = { id: 1, name: "Küche", colour: "yellow" };
const service: Position = { id: 2, name: "Service", colour: "red" };

const get = vi.spyOn(apiClient, "get");

afterEach(() => {
  get.mockReset();
});

function setup(positions: Position[]) {
  get.mockResolvedValue({ positions });
  return renderRoutes([{ path: "/", element: <PositionList /> }], { user: testUser });
}

describe("PositionList", () => {
  it("lists the positions, with a link to create another one in the last row", async () => {
    setup([kitchen, service]);

    expect(await screen.findByRole("rowheader", { name: "Küche" })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "Service" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Position" })).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith("/positions");

    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(4); // header + two positions + the link
    expect(screen.getByRole("link", { name: "+ Create new position" })).toHaveAttribute(
      "href",
      "/dashboard/positions/new",
    );
    expect(screen.queryByText("+ Add first position")).not.toBeInTheDocument();
  });

  it("has an Edit link for each position", async () => {
    setup([kitchen, service]);

    expect(await screen.findByRole("link", { name: "Edit Service" })).toHaveAttribute(
      "href",
      "/dashboard/positions/2/edit",
    );
  });

  it("opens the delete window for the row's position, and closes it on Cancel", async () => {
    setup([kitchen, service]);

    await userEvent.click(await screen.findByRole("button", { name: "Delete Küche" }));

    expect(screen.getByRole("dialog", { name: "Delete Küche?" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "Küche" })).toBeInTheDocument();
  });

  it("removes the position from the table once it is deleted", async () => {
    const del = vi.spyOn(apiClient, "delete").mockResolvedValue(null);
    setup([kitchen, service]);

    await userEvent.click(await screen.findByRole("button", { name: "Delete Küche" }));
    await userEvent.type(screen.getByLabelText('Type "Küche" to confirm'), "Küche");
    await userEvent.click(screen.getByRole("button", { name: "Delete position" }));

    await vi.waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(del).toHaveBeenCalledWith("/positions/1");
    expect(screen.queryByRole("rowheader", { name: "Küche" })).not.toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "Service" })).toBeInTheDocument();
    del.mockRestore();
  });

  it("shows an empty table with '+ Add first position' when there are none", async () => {
    setup([]);

    expect(await screen.findByRole("link", { name: "+ Add first position" })).toHaveAttribute(
      "href",
      "/dashboard/positions/new",
    );
    expect(screen.getAllByRole("row")).toHaveLength(2); // header + the link
  });

  it("keeps the table when a refresh in the background fails", async () => {
    const { queryClient } = setup([kitchen, service]);
    await screen.findByRole("rowheader", { name: "Küche" });

    get.mockRejectedValue(new ApiError(500, "Internal server error"));
    await act(() => queryClient.refetchQueries({ queryKey: positionsQuery.queryKey }));

    expect(queryClient.getQueryState(positionsQuery.queryKey)?.status).toBe("error");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "Küche" })).toBeInTheDocument();
  });

  it("shows the error message when loading fails", async () => {
    get.mockRejectedValue(new ApiError(500, "Internal server error"));
    renderRoutes([{ path: "/", element: <PositionList /> }], { user: testUser });

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load positions");
    expect(screen.getByRole("alert")).toHaveTextContent("Internal server error");
  });
});
