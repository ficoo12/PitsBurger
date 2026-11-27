import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiClient, toApiError } from "./apiClient";

const GENERIC = "Something went wrong. Please try again.";

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Runs the request and returns the ApiError it throws. */
async function failure(request: Promise<unknown>): Promise<ApiError> {
  const error = await request.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiClient.get", () => {
  it("requests /api + path with the session cookie and no body", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    await apiClient.get("/auth/me");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/me", {
      method: "GET",
      credentials: "include",
      headers: undefined,
      body: undefined,
    });
  });

  it("returns the parsed JSON body", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { user: { id: 1 } }));

    expect(await apiClient.get("/auth/me")).toEqual({ user: { id: 1 } });
  });
});

describe("apiClient.put", () => {
  it("sends the body as JSON with the PUT method", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    const body = { name: "Zentrum", openingHours: [] };

    await apiClient.put("/restaurants/1", body);

    expect(fetchMock).toHaveBeenCalledWith("/api/restaurants/1", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  });
});

describe("apiClient.delete", () => {
  it("sends a DELETE without a body and returns null for a 204", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    expect(await apiClient.delete("/restaurants/1")).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("/api/restaurants/1", {
      method: "DELETE",
      credentials: "include",
      headers: undefined,
      body: undefined,
    });
  });
});

describe("apiClient.post", () => {
  it("sends the body as JSON", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    const body = { email: "ana@example.com", password: "correct-horse" };

    await apiClient.post("/auth/login", body);

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  });

  it("sends a FormData body as it is, without a Content-Type of its own", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, {}));
    const form = new FormData();
    form.append("contractName", "Vollzeit");

    await apiClient.post("/contracts", form);

    expect(fetchMock).toHaveBeenCalledWith("/api/contracts", {
      method: "POST",
      credentials: "include",
      headers: undefined,
      body: form,
    });
  });

  it("sends no body and no Content-Type when there is nothing to send", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await apiClient.post("/auth/logout");

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      headers: undefined,
      body: undefined,
    });
  });

  it("returns null for a successful answer without a body (204)", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    expect(await apiClient.post("/auth/logout")).toBeNull();
  });
});

describe("failed requests", () => {
  it("throws an ApiError with the server's status and message", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(401, { error: "Invalid email or password" }),
    );

    const error = await failure(apiClient.post("/auth/login", {}));

    expect(error.status).toBe(401);
    expect(error.message).toBe("Invalid email or password");
    expect(error.fields).toEqual({});
  });

  it("passes on the field errors of a 400", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, {
        error: "Invalid input",
        fields: { email: ["Invalid email address"] },
      }),
    );

    const error = await failure(apiClient.post("/auth/signup", {}));

    expect(error.status).toBe(400);
    expect(error.fields).toEqual({ email: ["Invalid email address"] });
  });

  it("uses a generic message when the error is not a string", async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { error: { code: 1 } }));

    const error = await failure(apiClient.get("/auth/me"));

    expect(error.status).toBe(500);
    expect(error.message).toBe(GENERIC);
  });

  it("uses a generic message when the body has no error", async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, {}));

    const error = await failure(apiClient.get("/auth/me"));

    expect(error.message).toBe(GENERIC);
  });

  it("uses a generic message when the body is not JSON", async () => {
    fetchMock.mockResolvedValue(
      new Response("<html>Bad Gateway</html>", { status: 502 }),
    );

    const error = await failure(apiClient.get("/auth/me"));

    expect(error.status).toBe(502);
    expect(error.message).toBe(GENERIC);
    expect(error.fields).toEqual({});
  });

  it("throws status 0 when the server can't be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const error = await failure(apiClient.get("/auth/me"));

    expect(error.status).toBe(0);
    expect(error.message).toBe(
      "Can't reach the server. Check your connection and try again.",
    );
  });
});

describe("ApiError", () => {
  it("is an Error named ApiError, with no field errors by default", () => {
    const error = new ApiError(404, "Not found");

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ApiError");
    expect(error.status).toBe(404);
    expect(error.message).toBe("Not found");
    expect(error.fields).toEqual({});
  });
});

describe("toApiError", () => {
  it("returns an ApiError unchanged", () => {
    const error = new ApiError(409, "Couldn't create account");

    expect(toApiError(error)).toBe(error);
  });

  it.each([
    ["a plain Error", new Error("boom")],
    ["a string", "boom"],
    ["null", null],
    ["undefined", undefined],
  ])("turns %s into a generic ApiError with status 0", (_case, thrown) => {
    const error = toApiError(thrown);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
    expect(error.message).toBe(GENERIC);
  });
});
