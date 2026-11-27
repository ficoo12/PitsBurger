import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { and, eq } from "drizzle-orm";
import { app } from "../app.js";
import {
  appUser,
  availability,
  availabilityDay,
  contract,
  employee,
  employeeRestaurant,
  restaurantShift,
  schedule,
  scheduleEntry,
} from "../db/schema.js";
import { db, resetDatabase, closeDatabase } from "../../test/db.js";
import { signIn } from "../../test/auth.js";
import { colourPicker } from "../../test/fixtures.js";

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

// Monday 05.10.2026, the week of the Excel sheets.
const WEEK = "2026-10-05";
const MONDAY = "2026-10-05";
const TUESDAY = "2026-10-06";
const WEDNESDAY = "2026-10-07";

const SAME_TIME = "The shift can't start and end at the same time";

/** One of the owner's shifts, made through the API; returns its id. */
const nextColour = colourPicker();

async function addShift(
  cookie: string,
  name: string,
  startTime: string,
  endTime: string,
  shade: "early" | "late" | "full"
) {
  const res = await request(app)
    .post("/api/shifts")
    .set("Cookie", cookie)
    .send({ name, startTime, endTime, shade });
  return res.body.shift.id as number;
}

/** A restaurant made through the API; it gets every shift of the owner. */
async function addRestaurant(
  cookie: string,
  name: string,
  shifts: { frueh: number; spaet: number }
) {
  const res = await request(app)
    .post("/api/restaurants")
    .set("Cookie", cookie)
    .send({ name, colour: nextColour() });
  return {
    id: res.body.restaurant.id as number,
    colour: res.body.restaurant.colour as string,
    ...shifts,
  };
}

async function addUser(email: string) {
  const [{ id }] = await db
    .insert(appUser)
    .values({ email, role: "employee", passwordHash: "not-a-real-hash" })
    .returning({ id: appUser.id });
  return id;
}

/** An employee whose default is the first restaurant; they work in all. */
async function addEmployee(
  ownerId: number,
  contractId: number,
  userId: number,
  restaurantIds: number[]
) {
  const [{ id }] = await db
    .insert(employee)
    .values({ userId, ownerId, contractId, dateOfBirth: "2000-01-31" })
    .returning({ id: employee.id });
  await db.insert(employeeRestaurant).values(
    restaurantIds.map((restaurantId, index) => ({
      employeeId: id,
      restaurantId,
      ownerId,
      isDefault: index === 0,
    }))
  );
  return id;
}

/**
 * An owner with the shifts Früh (11–17) and Spät (17–23) and two
 * restaurants, Riverside and Harbour, which use both with the default times.
 * The owner also has Nacht, which only Harbour has (the API gives every
 * restaurant every shift; the row is removed by hand to test the check).
 * The restaurants have no opening hours, so they count as closed every day.
 * Mohammad works in both (Riverside is his default); Anduena works only in
 * Riverside.
 */
async function setUp(email = "owner@example.com") {
  const cookie = await signIn(email);
  const [{ id: ownerId }] = await db
    .select({ id: appUser.id })
    .from(appUser)
    .where(eq(appUser.email, email));
  const shifts = {
    frueh: await addShift(cookie, "Früh", "11:00", "17:00", "early"),
    spaet: await addShift(cookie, "Spät", "17:00", "23:00", "late"),
  };
  const riverside = await addRestaurant(cookie, "Riverside", shifts);
  const harbour = await addRestaurant(cookie, "Harbour", shifts);
  const nacht = await addShift(cookie, "Nacht", "22:00", "04:00", "full");
  await db
    .delete(restaurantShift)
    .where(
      and(
        eq(restaurantShift.restaurantId, riverside.id),
        eq(restaurantShift.shiftId, nacht)
      )
    );
  const [{ id: contractId }] = await db
    .insert(contract)
    .values({ ownerId, contractName: "Minijob", maxWeeklyHours: 10 })
    .returning({ id: contract.id });
  const mohammad = await addUser(`mohammad.${email}`);
  const anduena = await addUser(`anduena.${email}`);

  return {
    cookie,
    ownerId,
    riverside,
    harbour,
    nacht,
    mohammad: await addEmployee(ownerId, contractId, mohammad, [
      riverside.id,
      harbour.id,
    ]),
    anduena: await addEmployee(ownerId, contractId, anduena, [riverside.id]),
  };
}

type Fixture = Awaited<ReturnType<typeof setUp>>;

/** Mohammad works Früh in Riverside on Monday. */
function mondayCell(f: Fixture, changes: object = {}) {
  return {
    employeeId: f.mohammad,
    restaurantId: f.riverside.id,
    workDate: MONDAY,
    shiftId: f.riverside.frueh,
    ...changes,
  };
}

function getWeek(cookie: string, query: Record<string, string | number>) {
  return request(app).get("/api/schedules").query(query).set("Cookie", cookie);
}

function createEntry(cookie: string, body: object) {
  return request(app)
    .post("/api/schedules/entries")
    .set("Cookie", cookie)
    .send(body);
}

function updateEntry(cookie: string, id: number | string, body: object) {
  return request(app)
    .put(`/api/schedules/entries/${id}`)
    .set("Cookie", cookie)
    .send(body);
}

function deleteEntry(cookie: string, id: number | string) {
  return request(app)
    .delete(`/api/schedules/entries/${id}`)
    .set("Cookie", cookie);
}

async function markAsLeft(employeeId: number) {
  await db
    .update(employee)
    .set({ status: "left" })
    .where(eq(employee.id, employeeId));
}

/**
 * A week of someone's availability, written straight to the database (the
 * employee app's POST only saves next week, at the real time).
 */
async function addAvailability(
  f: Fixture,
  employeeId: number,
  note: string | null,
  days: { weekday: number; shiftId: number; dismissedAt?: Date }[],
  weekStart = WEEK
) {
  const [{ id }] = await db
    .insert(availability)
    .values({ employeeId, ownerId: f.ownerId, weekStart, note })
    .returning({ id: availability.id });
  if (days.length > 0) {
    await db
      .insert(availabilityDay)
      .values(days.map((day) => ({ ...day, availabilityId: id, ownerId: f.ownerId })));
  }
}

describe("schedule routes: access", () => {
  it("returns 401 without a session cookie", async () => {
    const responses = await Promise.all([
      request(app).get("/api/schedules").query({ restaurantId: 1, weekStart: WEEK }),
      request(app).post("/api/schedules/entries").send({}),
      request(app).put("/api/schedules/entries/1").send({}),
      request(app).delete("/api/schedules/entries/1"),
    ]);

    for (const res of responses) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: "Not signed in" });
    }
  });

  it("returns 403 for an employee", async () => {
    const cookie = await signIn("employee@example.com", {
      role: "employee",
    });

    const res = await getWeek(cookie, { restaurantId: 1, weekStart: WEEK });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "Only owners can do this" });
  });

});

describe("GET /api/schedules", () => {
  it("returns an empty week when it has no cells yet, without creating it", async () => {
    const f = await setUp();

    const res = await getWeek(f.cookie, {
      restaurantId: f.riverside.id,
      weekStart: WEEK,
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      schedule: {
        restaurantId: f.riverside.id,
        weekStart: WEEK,
        entries: [],
        availability: [],
      },
    });
    expect(await db.select().from(schedule)).toHaveLength(0);
  });

  it("returns only that restaurant's cells of that week, by day", async () => {
    const f = await setUp();
    const tuesday = await createEntry(
      f.cookie,
      mondayCell(f, {
        employeeId: f.anduena,
        workDate: TUESDAY,
        shiftId: f.riverside.spaet,
      })
    );
    const monday = await createEntry(f.cookie, mondayCell(f));
    // Not in the result: another restaurant, and the next week.
    await createEntry(f.cookie, {
      employeeId: f.mohammad,
      restaurantId: f.harbour.id,
      workDate: WEDNESDAY,
      shiftId: f.harbour.frueh,
    });
    await createEntry(f.cookie, mondayCell(f, { workDate: "2026-10-12" }));

    const res = await getWeek(f.cookie, {
      restaurantId: f.riverside.id,
      weekStart: WEEK,
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      schedule: {
        restaurantId: f.riverside.id,
        weekStart: WEEK,
        entries: [monday.body.entry, tuesday.body.entry],
        availability: [],
      },
    });
  });

  it("returns the availability of the people whose default restaurant this is", async () => {
    const f = await setUp();
    await addAvailability(f, f.mohammad, "Car 181", [
      { weekday: 3, shiftId: f.riverside.spaet },
      { weekday: 1, shiftId: f.riverside.frueh },
    ]);
    // A note but no days: not available all week, and the note still counts.
    await addAvailability(f, f.anduena, "On holiday", []);

    const res = await getWeek(f.cookie, {
      restaurantId: f.riverside.id,
      weekStart: WEEK,
    });

    expect(res.status).toBe(200);
    expect(res.body.schedule.availability).toEqual([
      {
        employeeId: f.mohammad,
        note: "Car 181",
        days: [
          { date: MONDAY, shiftId: f.riverside.frueh },
          { date: WEDNESDAY, shiftId: f.riverside.spaet },
        ],
      },
      { employeeId: f.anduena, note: "On holiday", days: [] },
    ]);
  });

  it("doesn't show availability in a restaurant that isn't the person's default", async () => {
    const f = await setUp();
    // Mohammad also works in Harbour, but Riverside is his default.
    await addAvailability(f, f.mohammad, null, [
      { weekday: 1, shiftId: f.riverside.frueh },
    ]);

    const res = await getWeek(f.cookie, {
      restaurantId: f.harbour.id,
      weekStart: WEEK,
    });

    expect(res.status).toBe(200);
    expect(res.body.schedule.availability).toEqual([]);
  });

  it("leaves out dismissed days, other weeks and people who have left", async () => {
    const f = await setUp();
    await addAvailability(f, f.mohammad, null, [
      { weekday: 1, shiftId: f.riverside.frueh, dismissedAt: new Date() },
      { weekday: 2, shiftId: f.riverside.spaet },
    ]);
    await addAvailability(
      f,
      f.mohammad,
      "Next week",
      [{ weekday: 1, shiftId: f.riverside.frueh }],
      "2026-10-12"
    );
    await addAvailability(f, f.anduena, "Left since", [
      { weekday: 1, shiftId: f.riverside.frueh },
    ]);
    await markAsLeft(f.anduena);

    const res = await getWeek(f.cookie, {
      restaurantId: f.riverside.id,
      weekStart: WEEK,
    });

    expect(res.status).toBe(200);
    expect(res.body.schedule.availability).toEqual([
      {
        employeeId: f.mohammad,
        note: null,
        days: [{ date: TUESDAY, shiftId: f.riverside.spaet }],
      },
    ]);
  });

  it("still returns a day that already has a cell, so clearing it brings the hint back", async () => {
    const f = await setUp();
    await addAvailability(f, f.mohammad, null, [
      { weekday: 1, shiftId: f.riverside.frueh },
    ]);
    const monday = await createEntry(f.cookie, mondayCell(f));

    const res = await getWeek(f.cookie, {
      restaurantId: f.riverside.id,
      weekStart: WEEK,
    });

    expect(res.status).toBe(200);
    expect(res.body.schedule.entries).toEqual([monday.body.entry]);
    expect(res.body.schedule.availability).toEqual([
      {
        employeeId: f.mohammad,
        note: null,
        days: [{ date: MONDAY, shiftId: f.riverside.frueh }],
      },
    ]);
  });

  it.each([
    ["a week that starts on a Tuesday", { weekStart: TUESDAY }, "weekStart"],
    ["a date that doesn't exist", { weekStart: "2026-02-30" }, "weekStart"],
    ["a badly formatted date", { weekStart: "05.10.2026" }, "weekStart"],
    ["a missing week", { weekStart: undefined }, "weekStart"],
    ["a restaurant id that isn't one", { restaurantId: "1e2" }, "restaurantId"],
  ])("returns 400 for %s", async (_label, changes, field) => {
    const f = await setUp();
    const query = { restaurantId: f.riverside.id, weekStart: WEEK, ...changes };
    const sent = Object.fromEntries(
      Object.entries(query).filter(([, v]) => v !== undefined)
    ) as Record<string, string | number>;

    const res = await getWeek(f.cookie, sent);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid input");
    expect(res.body.fields).toHaveProperty(field);
  });

  it("returns 404 for another owner's restaurant", async () => {
    const other = await setUp("other@example.com");
    const f = await setUp();

    const res = await getWeek(f.cookie, {
      restaurantId: other.riverside.id,
      weekStart: WEEK,
    });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Restaurant not found" });
  });
});

describe("POST /api/schedules/entries", () => {
  it("creates the cell, and the week's schedule with the first cell", async () => {
    const f = await setUp();

    const res = await createEntry(f.cookie, mondayCell(f));

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      entry: {
        id: expect.any(Number),
        employeeId: f.mohammad,
        workDate: MONDAY,
        shiftId: f.riverside.frueh,
        startTime: null,
        endTime: null,
        note: null,
      },
    });
    const weeks = await db.select().from(schedule);
    expect(weeks).toEqual([
      expect.objectContaining({ restaurantId: f.riverside.id, weekStart: WEEK }),
    ]);

    // A second cell in the same week uses the same schedule.
    const second = await createEntry(
      f.cookie,
      mondayCell(f, { employeeId: f.anduena })
    );
    expect(second.status).toBe(201);
    expect(await db.select().from(schedule)).toHaveLength(1);
    const cells = await db.select().from(scheduleEntry);
    expect(cells.map((c) => c.scheduleId)).toEqual([weeks[0].id, weeks[0].id]);
  });

  it("stores changed times and a trimmed note", async () => {
    const f = await setUp();

    // Excel: "Früh ab 12 - 18 | 181"
    const res = await createEntry(
      f.cookie,
      mondayCell(f, { startTime: "12:00", endTime: "18:00", note: "  181 " })
    );

    expect(res.status).toBe(201);
    expect(res.body.entry).toMatchObject({
      startTime: "12:00",
      endTime: "18:00",
      note: "181",
    });
    const [cell] = await db.select().from(scheduleEntry);
    expect(cell).toMatchObject({
      startTime: "12:00:00",
      endTime: "18:00:00",
      note: "181",
    });
  });

  it("saves a time equal to the shift's own time as no change, and an empty note as none", async () => {
    const f = await setUp();

    // Früh runs 11:00–17:00. Excel: "Früh bis 19.30"
    const res = await createEntry(
      f.cookie,
      mondayCell(f, { startTime: "11:00", endTime: "19:30", note: "   " })
    );

    expect(res.status).toBe(201);
    expect(res.body.entry).toMatchObject({
      startTime: null,
      endTime: "19:30",
      note: null,
    });
  });

  it("compares changed times with the restaurant's own times for the shift", async () => {
    const f = await setUp();
    // Riverside's Früh runs 09:00–17:00 instead of the default 11:00–17:00.
    await request(app)
      .put(`/api/restaurants/${f.riverside.id}`)
      .set("Cookie", f.cookie)
      .send({
        name: "Riverside",
        colour: f.riverside.colour,
        openingHours: [],
        shiftTimes: [
          { shiftId: f.riverside.frueh, startTime: "09:00", endTime: "17:00" },
          { shiftId: f.riverside.spaet, startTime: "17:00", endTime: "23:00" },
          { shiftId: f.nacht, startTime: "22:00", endTime: "04:00" },
        ],
      });

    const own = await createEntry(f.cookie, mondayCell(f, { startTime: "09:00" }));
    const changed = await createEntry(
      f.cookie,
      mondayCell(f, {
        employeeId: f.anduena,
        startTime: "11:00",
      })
    );

    expect(own.status).toBe(201);
    expect(own.body.entry.startTime).toBeNull();
    expect(changed.status).toBe(201);
    expect(changed.body.entry.startTime).toBe("11:00");
  });

  it("accepts a past week and a day the restaurant is closed", async () => {
    const f = await setUp(); // the restaurants have no opening hours

    const res = await createEntry(f.cookie, mondayCell(f, { workDate: "2020-01-06" }));

    expect(res.status).toBe(201);
    const weeks = await db.select().from(schedule);
    expect(weeks.map((w) => w.weekStart)).toEqual(["2020-01-06"]);
  });

  it.each<[string, (f: Fixture) => object, string, string?]>([
    [
      "an unknown employee",
      (f) => mondayCell(f, { employeeId: 999999 }),
      "employeeId",
      "Employee not found",
    ],
    [
      "a shift the restaurant doesn't have",
      (f) => mondayCell(f, { shiftId: f.nacht }),
      "shiftId",
      "Shift not found",
    ],
    [
      "changed times that start and end at the same time",
      (f) => mondayCell(f, { startTime: "15:00", endTime: "15:00" }),
      "endTime",
      SAME_TIME,
    ],
    [
      "a changed start equal to the shift's end",
      (f) => mondayCell(f, { startTime: "17:00" }),
      "endTime",
      SAME_TIME,
    ],
    ["a badly formatted time", (f) => mondayCell(f, { startTime: "9:00" }), "startTime"],
    [
      "a note over 100 characters",
      (f) => mondayCell(f, { note: "x".repeat(101) }),
      "note",
    ],
    [
      "a date that doesn't exist",
      (f) => mondayCell(f, { workDate: "2026-02-30" }),
      "workDate",
    ],
    [
      "a missing shift",
      (f) => ({
        employeeId: f.mohammad,
        restaurantId: f.riverside.id,
        workDate: MONDAY,
      }),
      "shiftId",
    ],
    [
      "a missing restaurant",
      (f) => ({
        employeeId: f.mohammad,
        workDate: MONDAY,
        shiftId: f.riverside.frueh,
      }),
      "restaurantId",
    ],
  ])("returns 400 for %s and saves nothing", async (_label, body, field, message) => {
    const f = await setUp();

    const res = await createEntry(f.cookie, body(f));

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid input");
    expect(res.body.fields).toHaveProperty(field);
    if (message) expect(res.body.fields[field]).toEqual([message]);
    expect(await db.select().from(scheduleEntry)).toHaveLength(0);
    expect(await db.select().from(schedule)).toHaveLength(0);
  });

  it("returns 400 for another owner's employee", async () => {
    const other = await setUp("other@example.com");
    const f = await setUp();

    const res = await createEntry(
      f.cookie,
      mondayCell(f, { employeeId: other.mohammad })
    );

    expect(res.status).toBe(400);
    expect(res.body.fields).toEqual({ employeeId: ["Employee not found"] });
    expect(await db.select().from(scheduleEntry)).toHaveLength(0);
  });

  it("returns 400 for a restaurant the employee doesn't work in", async () => {
    const other = await setUp("other@example.com");
    const f = await setUp();

    const elsewhere = await createEntry(
      f.cookie,
      mondayCell(f, {
        employeeId: f.anduena,
        restaurantId: f.harbour.id,
        shiftId: f.harbour.frueh,
      })
    );
    const foreign = await createEntry(
      f.cookie,
      mondayCell(f, { restaurantId: other.riverside.id })
    );

    for (const res of [elsewhere, foreign]) {
      expect(res.status).toBe(400);
      expect(res.body.fields).toEqual({
        restaurantId: ["This employee doesn't work in this restaurant"],
      });
    }
    expect(await db.select().from(scheduleEntry)).toHaveLength(0);
  });

  it("returns 400 for an employee who has left", async () => {
    const f = await setUp();
    await markAsLeft(f.mohammad);

    const res = await createEntry(f.cookie, mondayCell(f));

    expect(res.status).toBe(400);
    expect(res.body.fields).toEqual({ employeeId: ["This employee has left"] });
    expect(await db.select().from(scheduleEntry)).toHaveLength(0);
  });

  it("returns 409 when the employee already has a shift that day", async () => {
    const f = await setUp();
    await createEntry(f.cookie, mondayCell(f));

    const res = await createEntry(
      f.cookie,
      mondayCell(f, { shiftId: f.riverside.spaet })
    );

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: "This employee already has a shift on this day",
    });
    expect(await db.select().from(scheduleEntry)).toHaveLength(1);
  });

  it("returns 409 naming the restaurant when the person works elsewhere that day", async () => {
    const f = await setUp();
    await createEntry(f.cookie, mondayCell(f));

    const res = await createEntry(f.cookie, {
      employeeId: f.mohammad,
      restaurantId: f.harbour.id,
      workDate: MONDAY,
      shiftId: f.harbour.spaet,
    });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: "This employee already works at Riverside on this day",
    });
    expect(await db.select().from(scheduleEntry)).toHaveLength(1);
  });
});

describe("PUT /api/schedules/entries/:id", () => {
  it("changes the shift, times and note, but not the employee or day", async () => {
    const f = await setUp();
    const created = await createEntry(f.cookie, mondayCell(f, { note: "181" }));
    const id = created.body.entry.id;

    // Excel: "Spät ab 18 K | F | 181"
    const res = await updateEntry(f.cookie, id, {
      shiftId: f.riverside.spaet,
      startTime: "18:00",
      endTime: null,
      note: "K | F | 181",
      employeeId: f.anduena,
      workDate: TUESDAY,
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      entry: {
        id,
        employeeId: f.mohammad,
        workDate: MONDAY,
        shiftId: f.riverside.spaet,
        startTime: "18:00",
        endTime: null,
        note: "K | F | 181",
      },
    });
    const week = await getWeek(f.cookie, {
      restaurantId: f.riverside.id,
      weekStart: WEEK,
    });
    expect(week.body.schedule.entries).toEqual([res.body.entry]);
  });

  it("can change a cell of an employee who has left", async () => {
    const f = await setUp();
    const created = await createEntry(f.cookie, mondayCell(f));
    await markAsLeft(f.mohammad);

    const res = await updateEntry(f.cookie, created.body.entry.id, {
      shiftId: f.riverside.spaet,
      startTime: null,
      endTime: null,
      note: "krank",
    });

    expect(res.status).toBe(200);
    expect(res.body.entry).toMatchObject({ shiftId: f.riverside.spaet, note: "krank" });
  });

  it.each<[string, (f: Fixture) => object, string]>([
    [
      "a shift the restaurant doesn't have",
      (f) => ({ shiftId: f.nacht, startTime: null, endTime: null, note: null }),
      "shiftId",
    ],
    [
      "changed times that start and end at the same time",
      (f) => ({ shiftId: f.riverside.spaet, startTime: "20:00", endTime: "20:00", note: null }),
      "endTime",
    ],
    [
      "a missing note (PUT needs every field)",
      (f) => ({ shiftId: f.riverside.spaet, startTime: null, endTime: null }),
      "note",
    ],
  ])("returns 400 for %s and changes nothing", async (_label, body, field) => {
    const f = await setUp();
    const created = await createEntry(f.cookie, mondayCell(f));

    const res = await updateEntry(f.cookie, created.body.entry.id, body(f));

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid input");
    expect(res.body.fields).toHaveProperty(field);
    const [cell] = await db.select().from(scheduleEntry);
    expect(cell.shiftId).toBe(f.riverside.frueh);
  });

  it("returns 404 for another owner's cell and leaves it unchanged", async () => {
    const other = await setUp("other@example.com");
    const created = await createEntry(other.cookie, mondayCell(other));
    const f = await setUp();

    const res = await updateEntry(f.cookie, created.body.entry.id, {
      shiftId: f.riverside.spaet,
      startTime: null,
      endTime: null,
      note: "hijacked",
    });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Schedule entry not found" });
    const [cell] = await db.select().from(scheduleEntry);
    expect(cell.note).toBeNull();
  });

  it.each(["999999", "abc", "01"])("returns 404 for the id %s", async (id) => {
    const f = await setUp();

    const res = await updateEntry(f.cookie, id, {
      shiftId: f.riverside.spaet,
      startTime: null,
      endTime: null,
      note: null,
    });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Schedule entry not found" });
  });
});

describe("DELETE /api/schedules/entries/:id", () => {
  it("clears the cell and returns 204", async () => {
    const f = await setUp();
    const created = await createEntry(f.cookie, mondayCell(f));

    const res = await deleteEntry(f.cookie, created.body.entry.id);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
    expect(await db.select().from(scheduleEntry)).toHaveLength(0);
    const week = await getWeek(f.cookie, {
      restaurantId: f.riverside.id,
      weekStart: WEEK,
    });
    expect(week.body.schedule.entries).toEqual([]);
  });

  it("can clear a cell of an employee who has left", async () => {
    const f = await setUp();
    const created = await createEntry(f.cookie, mondayCell(f));
    await markAsLeft(f.mohammad);

    const res = await deleteEntry(f.cookie, created.body.entry.id);

    expect(res.status).toBe(204);
    expect(await db.select().from(scheduleEntry)).toHaveLength(0);
  });

  it("returns 404 for another owner's cell and leaves it in place", async () => {
    const other = await setUp("other@example.com");
    const created = await createEntry(other.cookie, mondayCell(other));
    const f = await setUp();

    const res = await deleteEntry(f.cookie, created.body.entry.id);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Schedule entry not found" });
    expect(await db.select().from(scheduleEntry)).toHaveLength(1);
  });

  it.each(["999999", "abc"])("returns 404 for the id %s", async (id) => {
    const f = await setUp();

    const res = await deleteEntry(f.cookie, id);

    expect(res.status).toBe(404);
  });
});
