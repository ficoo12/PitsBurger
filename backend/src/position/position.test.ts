import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { app } from "../app.js";
import {
  appUser,
  contract,
  employee,
  employeePosition,
  position,
  restaurant,
} from "../db/schema.js";
import { db, resetDatabase, closeDatabase } from "../../test/db.js";
import { signIn } from "../../test/auth.js";

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

const signInOwner = (email = "owner@example.com") => signIn(email);

async function createPosition(cookie: string, body: object) {
  return request(app).post("/api/positions").set("Cookie", cookie).send(body);
}

describe("POST /api/positions", () => {
  it("returns 401 without a session cookie", async () => {
    const res = await request(app)
      .post("/api/positions")
      .send({ name: "Küche", colour: "yellow" });

    expect(res.status).toBe(401);
    expect(await db.select().from(position)).toHaveLength(0);
  });

  it("returns 403 for an employee", async () => {
    const cookie = await signIn("employee@example.com", {
      role: "employee",
    });

    const res = await createPosition(cookie, { name: "Küche", colour: "yellow" });

    expect(res.status).toBe(403);
    expect(await db.select().from(position)).toHaveLength(0);
  });

  it("creates a position for the signed-in owner", async () => {
    const cookie = await signInOwner();

    const res = await createPosition(cookie, { name: "  Küche  ", colour: "yellow" });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      position: { id: expect.any(Number), name: "Küche", colour: "yellow" },
    });

    const [owner] = await db
      .select({ id: appUser.id })
      .from(appUser)
      .where(eq(appUser.email, "owner@example.com"));
    expect(await db.select().from(position)).toEqual([
      { id: res.body.position.id, ownerId: owner.id, name: "Küche", colour: "yellow" },
    ]);
  });

  it("ignores an ownerId sent by the client", async () => {
    const cookie = await signInOwner();
    await signInOwner("other@example.com");
    const [other] = await db
      .select({ id: appUser.id })
      .from(appUser)
      .where(eq(appUser.email, "other@example.com"));

    const res = await createPosition(cookie, {
      name: "Küche",
      colour: "yellow",
      ownerId: other.id,
    });

    expect(res.status).toBe(201);
    const [row] = await db.select().from(position);
    expect(row.ownerId).not.toBe(other.id);
  });

  it("returns 400 for a missing, empty or too long name", async () => {
    const cookie = await signInOwner();

    for (const name of [undefined, "   ", "x".repeat(101), 5]) {
      const res = await createPosition(cookie, { name, colour: "yellow" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid input");
      expect(res.body.fields).toHaveProperty("name");
    }
    expect(await db.select().from(position)).toHaveLength(0);
  });

  it("returns 400 for a missing or unknown colour", async () => {
    const cookie = await signInOwner();

    for (const colour of [undefined, "", "black", "white", "#ff0000", 3]) {
      const res = await createPosition(cookie, { name: "Küche", colour });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid input");
      expect(res.body.fields).toHaveProperty("colour");
    }
    expect(await db.select().from(position)).toHaveLength(0);
  });

  it("returns 409 when the owner already has a position with this name", async () => {
    const cookie = await signInOwner();
    await createPosition(cookie, { name: "Küche", colour: "yellow" });

    // A free colour, so only the name is taken.
    const res = await createPosition(cookie, { name: " Küche ", colour: "red" });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: "A position with this name already exists",
    });
    expect(await db.select().from(position)).toHaveLength(1);
  });

  it("returns 409 with the colour field when another position has this colour", async () => {
    const cookie = await signInOwner();
    await createPosition(cookie, { name: "Küche", colour: "yellow" });

    const res = await createPosition(cookie, { name: "Kasse", colour: "yellow" });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: "Another position already has this colour",
      fields: { colour: ["Another position already has this colour"] },
    });
    expect(await db.select().from(position)).toHaveLength(1);
  });

  it("lets two owners use the same position name and colour", async () => {
    const first = await signInOwner();
    const second = await signInOwner("other@example.com");
    await createPosition(first, { name: "Küche", colour: "yellow" });

    const res = await createPosition(second, { name: "Küche", colour: "yellow" });

    expect(res.status).toBe(201);
    expect(await db.select().from(position)).toHaveLength(2);
  });
});

async function ownerId(email = "owner@example.com") {
  const [owner] = await db
    .select({ id: appUser.id })
    .from(appUser)
    .where(eq(appUser.email, email));
  return owner.id;
}

/** Creates a position through the API and returns its id. */
async function positionId(cookie: string, name = "Küche", colour = "yellow") {
  const res = await createPosition(cookie, { name, colour });
  return res.body.position.id as number;
}

const updatePosition = (cookie: string, id: number | string, body: object) =>
  request(app).put(`/api/positions/${id}`).set("Cookie", cookie).send(body);

const deletePosition = (cookie: string, id: number | string) =>
  request(app).delete(`/api/positions/${id}`).set("Cookie", cookie);

const MALFORMED_IDS = ["abc", "012", "1e2", "0x1F", "0", "-1"];

describe("PUT /api/positions/:id", () => {
  it("returns 401 without a session cookie", async () => {
    const cookie = await signInOwner();
    const id = await positionId(cookie);

    const res = await request(app)
      .put(`/api/positions/${id}`)
      .send({ name: "Service", colour: "yellow" });

    expect(res.status).toBe(401);
    const [row] = await db.select().from(position);
    expect(row.name).toBe("Küche");
  });

  it("returns 403 for an employee", async () => {
    const owner = await signInOwner();
    const id = await positionId(owner);
    const cookie = await signIn("employee@example.com", {
      role: "employee",
    });

    const res = await updatePosition(cookie, id, { name: "Service", colour: "yellow" });

    expect(res.status).toBe(403);
  });

  it("renames the position, changes its colour and returns it", async () => {
    const cookie = await signInOwner();
    const id = await positionId(cookie);

    const res = await updatePosition(cookie, id, { name: "  Service  ", colour: "red" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ position: { id, name: "Service", colour: "red" } });
    expect(await db.select().from(position)).toEqual([
      { id, ownerId: await ownerId(), name: "Service", colour: "red" },
    ]);
  });

  it("ignores an ownerId sent by the client", async () => {
    const cookie = await signInOwner();
    await signInOwner("other@example.com");
    const id = await positionId(cookie);

    const res = await updatePosition(cookie, id, {
      name: "Service",
      colour: "yellow",
      ownerId: await ownerId("other@example.com"),
    });

    expect(res.status).toBe(200);
    const [row] = await db.select().from(position);
    expect(row.ownerId).toBe(await ownerId());
  });

  it("allows saving the current name and colour again", async () => {
    const cookie = await signInOwner();
    const id = await positionId(cookie);

    const res = await updatePosition(cookie, id, { name: "Küche", colour: "yellow" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ position: { id, name: "Küche", colour: "yellow" } });
  });

  it("returns 400 for a missing, empty or too long name", async () => {
    const cookie = await signInOwner();
    const id = await positionId(cookie);

    for (const name of [undefined, "   ", "x".repeat(101), 5]) {
      const res = await updatePosition(cookie, id, { name, colour: "yellow" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid input");
      expect(res.body.fields).toHaveProperty("name");
    }
    const [row] = await db.select().from(position);
    expect(row.name).toBe("Küche");
  });

  it("returns 400 for a missing or unknown colour", async () => {
    const cookie = await signInOwner();
    const id = await positionId(cookie);

    // PUT replaces the whole position, so the colour can't be left out.
    for (const colour of [undefined, "black", "#ff0000"]) {
      const res = await updatePosition(cookie, id, { name: "Küche", colour });

      expect(res.status).toBe(400);
      expect(res.body.fields).toHaveProperty("colour");
    }
    const [row] = await db.select().from(position);
    expect(row.colour).toBe("yellow");
  });

  it("returns 409 when another position of the owner has this name", async () => {
    const cookie = await signInOwner();
    await positionId(cookie, "Küche");
    const id = await positionId(cookie, "Service", "red");

    const res = await updatePosition(cookie, id, { name: " Küche ", colour: "red" });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: "A position with this name already exists",
    });
    const [row] = await db.select().from(position).where(eq(position.id, id));
    expect(row.name).toBe("Service");
  });

  it("returns 409 with the colour field when another position has this colour", async () => {
    const cookie = await signInOwner();
    await positionId(cookie, "Küche", "yellow");
    const id = await positionId(cookie, "Service", "red");

    const res = await updatePosition(cookie, id, { name: "Service", colour: "yellow" });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: "Another position already has this colour",
      fields: { colour: ["Another position already has this colour"] },
    });
    const [row] = await db.select().from(position).where(eq(position.id, id));
    expect(row.colour).toBe("red");
  });

  it("lets an owner use a name another owner already has", async () => {
    const first = await signInOwner();
    const second = await signInOwner("other@example.com");
    await positionId(first, "Küche");
    const id = await positionId(second, "Service", "red");

    const res = await updatePosition(second, id, { name: "Küche", colour: "yellow" });

    expect(res.status).toBe(200);
  });

  it("returns 404 for a malformed or unknown id", async () => {
    const cookie = await signInOwner();
    const id = await positionId(cookie);

    for (const bad of [...MALFORMED_IDS, id + 1]) {
      const res = await updatePosition(cookie, bad, { name: "Service", colour: "red" });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Position not found" });
    }
  });

  it("returns 404 for another owner's position and leaves it unchanged", async () => {
    const owner = await signInOwner();
    const other = await signInOwner("other@example.com");
    const id = await positionId(other);

    const res = await updatePosition(owner, id, { name: "Service", colour: "red" });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Position not found" });
    const [row] = await db.select().from(position);
    expect(row.name).toBe("Küche");
  });
});

describe("DELETE /api/positions/:id", () => {
  it("returns 401 without a session cookie", async () => {
    const cookie = await signInOwner();
    const id = await positionId(cookie);

    const res = await request(app).delete(`/api/positions/${id}`);

    expect(res.status).toBe(401);
    expect(await db.select().from(position)).toHaveLength(1);
  });

  it("returns 403 for an employee", async () => {
    const owner = await signInOwner();
    const id = await positionId(owner);
    const cookie = await signIn("employee@example.com", {
      role: "employee",
    });

    const res = await deletePosition(cookie, id);

    expect(res.status).toBe(403);
    expect(await db.select().from(position)).toHaveLength(1);
  });

  it("deletes the position and returns 204", async () => {
    const cookie = await signInOwner();
    const id = await positionId(cookie, "Küche");
    const keep = await positionId(cookie, "Service", "red");

    const res = await deletePosition(cookie, id);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
    expect(await db.select({ id: position.id }).from(position)).toEqual([
      { id: keep },
    ]);
  });

  it("removes the position from employees but keeps the employees", async () => {
    const cookie = await signInOwner();
    const owner = await ownerId();
    const [{ id: restaurantId }] = await db
      .insert(restaurant)
      .values({ name: "Zentrum", colour: "teal", ownerId: owner })
      .returning({ id: restaurant.id });
    const [{ id: contractId }] = await db
      .insert(contract)
      .values({ ownerId: owner, contractName: "Vollzeit", maxWeeklyHours: 40 })
      .returning({ id: contract.id });
    const kueche = await positionId(cookie, "Küche");
    const service = await positionId(cookie, "Service", "red");
    const created = await request(app)
      .post("/api/employees")
      .set("Cookie", cookie)
      .send({
        firstName: "Anna",
        lastName: "Schmidt",
        email: "anna@example.com",
        dateOfBirth: "1998-03-13",
        contractId,
        defaultRestaurantId: restaurantId,
        positionIds: [kueche, service],
      });
    expect(created.status).toBe(201);

    const res = await deletePosition(cookie, kueche);

    expect(res.status).toBe(204);
    expect(await db.select().from(employee)).toHaveLength(1);
    expect(
      await db
        .select({ positionId: employeePosition.positionId })
        .from(employeePosition)
    ).toEqual([{ positionId: service }]);
  });

  it("returns 404 for a malformed or unknown id", async () => {
    const cookie = await signInOwner();
    const id = await positionId(cookie);

    for (const bad of [...MALFORMED_IDS, id + 1]) {
      const res = await deletePosition(cookie, bad);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Position not found" });
    }
    expect(await db.select().from(position)).toHaveLength(1);
  });

  it("returns 404 for another owner's position and keeps it", async () => {
    const owner = await signInOwner();
    const other = await signInOwner("other@example.com");
    const id = await positionId(other);

    const res = await deletePosition(owner, id);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Position not found" });
    expect(await db.select().from(position)).toHaveLength(1);
  });
});
