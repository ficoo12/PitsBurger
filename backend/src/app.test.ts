import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "./app.js";

describe("request errors", () => {
  it("returns 400 for malformed JSON", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("{bad json");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid request" });
  });

  it("returns 413 for a body over the size limit", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "owner@example.com", password: "x".repeat(20_000) });

    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: "Request too large" });
  });

  it("returns a JSON 404 for an unknown route", async () => {
    const res = await request(app).get("/api/no-such-route");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
  });
});
