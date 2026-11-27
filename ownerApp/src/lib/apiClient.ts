/** A failed API request. `message` is safe to show to the user. */
export class ApiError extends Error {
  /** HTTP status, or 0 when the server couldn't be reached. */
  readonly status: number;
  /** Per-field messages from a 400 validation error, e.g. `{ email: ["Invalid email address"] }`. */
  readonly fields: Record<string, string[] | undefined>;
  /** The rest of the error body, e.g. the `shifts` or `employees` list that comes with a 409. */
  readonly details: Record<string, unknown>;

  constructor(
    status: number,
    message: string,
    fields: Record<string, string[] | undefined> = {},
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
    this.details = details;
  }
}

/** Requests only throw ApiErrors; anything else would be a bug, so it gets a generic message. */
export function toApiError(error: unknown): ApiError {
  return error instanceof ApiError
    ? error
    : new ApiError(0, "Something went wrong. Please try again.");
}

/**
 * The backend answers errors with `{ error: "message" }`, plus `fields` for
 * invalid input, and sometimes more (a 409's list of what is in the way).
 */
type ErrorBody = {
  error?: unknown;
  fields?: Record<string, string[] | undefined>;
  [key: string]: unknown;
};

async function request<T>(method: "GET" | "POST" | "PUT" | "DELETE", path: string, body?: unknown): Promise<T> {
  // A FormData body (a file upload) is sent as it is: the browser sets its
  // multipart Content-Type, including the boundary. Anything else goes as JSON.
  const isForm = body instanceof FormData;
  let response: Response;
  try {
    // "/api" goes through the Vite proxy to the backend (see vite.config.ts).
    response = await fetch(`/api${path}`, {
      method,
      credentials: "include",
      headers: body === undefined || isForm ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }

  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    // A body that isn't an object (null, a string) has nothing to read.
    const body: ErrorBody = typeof data === "object" && data !== null ? (data as ErrorBody) : {};
    const { error, fields, ...details } = body;
    throw new ApiError(
      response.status,
      typeof error === "string" ? error : "Something went wrong. Please try again.",
      fields ?? {},
      details,
    );
  }
  return data as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};
