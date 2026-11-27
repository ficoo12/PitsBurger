import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiClient } from "../../../lib/apiClient";
import type { Position } from "../types";
import { createPosition } from "./createPosition";
import { deletePosition } from "./deletePosition";
import { editPosition } from "./editPosition";
import { getPositions } from "./getPositions";

const service: Position = { id: 10, name: "Service", colour: "red" };

const get = vi.spyOn(apiClient, "get");
const post = vi.spyOn(apiClient, "post");
const put = vi.spyOn(apiClient, "put");
const del = vi.spyOn(apiClient, "delete");

afterEach(() => {
  get.mockReset();
  post.mockReset();
  put.mockReset();
  del.mockReset();
});

describe("getPositions", () => {
  it("asks GET /positions and returns the list", async () => {
    get.mockResolvedValue({ positions: [service] });

    expect(await getPositions()).toEqual([service]);
    expect(get).toHaveBeenCalledWith("/positions");
  });

  it("throws the ApiError when the request fails", async () => {
    const error = new ApiError(403, "Only owners can do this");
    get.mockRejectedValue(error);

    await expect(getPositions()).rejects.toBe(error);
  });
});

describe("createPosition", () => {
  it("posts the input to /positions and returns the new position", async () => {
    post.mockResolvedValue({ position: service });

    expect(await createPosition({ name: "Service", colour: "red" })).toEqual(service);
    expect(post).toHaveBeenCalledWith("/positions", { name: "Service", colour: "red" });
  });

  it("throws the ApiError when the request fails", async () => {
    const error = new ApiError(409, "A position with this name already exists");
    post.mockRejectedValue(error);

    await expect(createPosition({ name: "Service", colour: "red" })).rejects.toBe(error);
  });
});

describe("editPosition", () => {
  it("puts the input to /positions/:id and returns the updated position", async () => {
    put.mockResolvedValue({ position: service });

    expect(await editPosition(10, { name: "Service", colour: "red" })).toEqual(service);
    expect(put).toHaveBeenCalledWith("/positions/10", { name: "Service", colour: "red" });
  });

  it("throws the ApiError when the request fails", async () => {
    const error = new ApiError(404, "Position not found");
    put.mockRejectedValue(error);

    await expect(editPosition(10, { name: "Service", colour: "red" })).rejects.toBe(error);
  });
});

describe("deletePosition", () => {
  it("sends DELETE /positions/:id and returns nothing", async () => {
    del.mockResolvedValue(null);

    expect(await deletePosition(10)).toBeUndefined();
    expect(del).toHaveBeenCalledWith("/positions/10");
  });

  it("throws the ApiError when the request fails", async () => {
    const error = new ApiError(404, "Position not found");
    del.mockRejectedValue(error);

    await expect(deletePosition(10)).rejects.toBe(error);
  });
});
