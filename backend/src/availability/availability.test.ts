import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  afterAll,
} from "vitest";
import request from "supertest";
import { and, asc, eq } from "drizzle-orm";
import { app } from "../app.js";
import {
  appUser,
  availability,
  availabilityDay,
  availabilitySettings,
  contract,
  employeeRestaurant,
  restaurant,
  restaurantOpeningHours,
} from "../db/schema.js";
import { db, resetDatabase, closeDatabase } from "../../test/db.js";
import { signIn, TEST_PASSWORD, TEST_PASSWORD_HASH } from "../../test/auth.js";

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

const signInOwner = (email = "owner@example.com") => signIn(email);

async function ownerIdOf(email: string) {
  const [row] = await db
    .select({ id: appUser.id })
    .from(appUser)
    .where(eq(appUser.email, email));
  return row.id;
}

const defaults = {
  opensWeekday: 5,
  opensTime: "00:00",
  closesWeekday: 7,
  closesTime: "23:59",
  maxSaves: 3,
};

// Wednesday 08:30 to Thursday 20:00, 5 saves.
const custom = {
  opensWeekday: 3,
  opensTime: "08:30",
  closesWeekday: 4,
  closesTime: "20:00",
  maxSaves: 5,
};

function getSettings(cookie: string) {
  return request(app).get("/api/availability/settings").set("Cookie", cookie);
}

function putSettings(cookie: string, body: object) {
  return request(app)
    .put("/api/availability/settings")
    .set("Cookie", cookie)
    .send(body);
}

describe("GET /api/availability/settings", () => {
  it("returns 401 without a session cookie", async () => {
    const res = await request(app).get("/api/availability/settings");

    expect(res.status).toBe(401);
  });

  it("returns 403 for an employee", async () => {
    const cookie = await signIn("employee@example.com", {
      role: "employee",
    });

    const res = await getSettings(cookie);

    expect(res.status).toBe(403);
  });

  it("returns the defaults when the owner never saved settings", async () => {
    const cookie = await signInOwner();

    const res = await getSettings(cookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ settings: defaults });
    expect(await db.select().from(availabilitySettings)).toHaveLength(0);
  });

  it("returns the saved settings", async () => {
    const cookie = await signInOwner();
    await putSettings(cookie, custom);

    const res = await getSettings(cookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ settings: custom });
  });

  it("never returns another owner's settings", async () => {
    const other = await signInOwner("other@example.com");
    await putSettings(other, custom);
    const cookie = await signInOwner();

    const res = await getSettings(cookie);

    expect(res.body).toEqual({ settings: defaults });
  });
});

describe("PUT /api/availability/settings", () => {
  it("returns 401 without a session cookie", async () => {
    const res = await request(app)
      .put("/api/availability/settings")
      .send(custom);

    expect(res.status).toBe(401);
    expect(await db.select().from(availabilitySettings)).toHaveLength(0);
  });

  it("returns 403 for an employee", async () => {
    const cookie = await signIn("employee@example.com", {
      role: "employee",
    });

    const res = await putSettings(cookie, custom);

    expect(res.status).toBe(403);
    expect(await db.select().from(availabilitySettings)).toHaveLength(0);
  });

  it("creates the settings on the first save", async () => {
    const cookie = await signInOwner();

    const res = await putSettings(cookie, custom);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ settings: custom });

    const ownerId = await ownerIdOf("owner@example.com");
    expect(await db.select().from(availabilitySettings)).toEqual([
      {
        ownerId,
        opensWeekday: 3,
        opensTime: "08:30:00",
        closesWeekday: 4,
        closesTime: "20:00:00",
        maxSaves: 5,
        updatedAt: expect.any(Date),
      },
    ]);
  });

  it("updates the same row on the next save", async () => {
    const cookie = await signInOwner();
    await putSettings(cookie, custom);
    const changed = { ...defaults, opensWeekday: 6, maxSaves: 1 };

    const res = await putSettings(cookie, changed);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ settings: changed });
    const rows = await db.select().from(availabilitySettings);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      opensWeekday: 6,
      opensTime: "00:00:00",
      closesWeekday: 7,
      closesTime: "23:59:00",
      maxSaves: 1,
    });
  });

  it("ignores an ownerId sent by the client", async () => {
    const cookie = await signInOwner();
    await signInOwner("other@example.com");
    const otherId = await ownerIdOf("other@example.com");

    const res = await putSettings(cookie, { ...custom, ownerId: otherId });

    expect(res.status).toBe(200);
    const [row] = await db.select().from(availabilitySettings);
    expect(row.ownerId).toBe(await ownerIdOf("owner@example.com"));
  });

  it("leaves another owner's settings unchanged", async () => {
    const other = await signInOwner("other@example.com");
    await putSettings(other, custom);
    const cookie = await signInOwner();

    await putSettings(cookie, defaults);

    const otherId = await ownerIdOf("other@example.com");
    const [row] = await db
      .select()
      .from(availabilitySettings)
      .where(eq(availabilitySettings.ownerId, otherId));
    expect(row).toMatchObject({ opensWeekday: 3, maxSaves: 5 });
  });

  it.each([
    ["opensWeekday", 0],
    ["opensWeekday", 8],
    ["opensWeekday", 2.5],
    ["opensWeekday", "3"],
    ["closesWeekday", 0],
    ["closesWeekday", 8],
    ["opensTime", "24:00"],
    ["opensTime", "9:00"],
    ["opensTime", "09:00:00"],
    ["closesTime", "20:60"],
    ["closesTime", 2000],
    ["maxSaves", 0],
    ["maxSaves", 6],
    ["maxSaves", 2.5],
    ["maxSaves", "3"],
  ])("returns 400 for %s = %j", async (field, value) => {
    const cookie = await signInOwner();

    const res = await putSettings(cookie, { ...custom, [field]: value });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid input");
    expect(res.body.fields).toHaveProperty(field);
    expect(await db.select().from(availabilitySettings)).toHaveLength(0);
  });

  it.each([
    "opensWeekday",
    "opensTime",
    "closesWeekday",
    "closesTime",
    "maxSaves",
  ])("returns 400 when %s is missing", async (field) => {
    const cookie = await signInOwner();
    const body: Record<string, unknown> = { ...custom };
    delete body[field];

    const res = await putSettings(cookie, body);

    expect(res.status).toBe(400);
    expect(res.body.fields).toHaveProperty(field);
  });

  it.each([
    ["a later weekday", { opensWeekday: 7, closesWeekday: 5 }],
    [
      "a later time on the same day",
      { opensWeekday: 5, opensTime: "18:00", closesWeekday: 5, closesTime: "10:00" },
    ],
    [
      "the same weekday and time",
      { opensWeekday: 5, opensTime: "10:00", closesWeekday: 5, closesTime: "10:00" },
    ],
  ])("returns 400 when it opens at %s than it closes", async (_label, window) => {
    const cookie = await signInOwner();

    const res = await putSettings(cookie, { ...custom, ...window });

    expect(res.status).toBe(400);
    expect(res.body.fields).toEqual({
      closesTime: ["The window must close after it opens"],
    });
    expect(await db.select().from(availabilitySettings)).toHaveLength(0);
  });

  it.each([
    [
      "the whole week",
      { opensWeekday: 1, opensTime: "00:00", closesWeekday: 7, closesTime: "23:59" },
    ],
    [
      "one day with a later closing time",
      { opensWeekday: 5, opensTime: "10:00", closesWeekday: 5, closesTime: "10:01" },
    ],
    [
      "an earlier closing time on a later day",
      { opensWeekday: 4, opensTime: "18:00", closesWeekday: 5, closesTime: "08:00" },
    ],
  ])("accepts %s", async (_label, window) => {
    const cookie = await signInOwner();
    const body = { ...custom, ...window };

    const res = await putSettings(cookie, body);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ settings: body });
  });

  it("accepts 1 and 5 saves", async () => {
    const cookie = await signInOwner();

    for (const maxSaves of [1, 5]) {
      const res = await putSettings(cookie, { ...custom, maxSaves });

      expect(res.status).toBe(200);
      expect(res.body.settings.maxSaves).toBe(maxSaves);
    }
  });
});

// --- POST /api/availability: an employee saves next week's availability ---

// Friday 2026-11-27 12:00 in Berlin (winter time, UTC+1): inside the default
// window (Friday 00:00 to Sunday 23:59). Next week starts on 2026-11-30.
const FRIDAY_NOON = new Date("2026-11-27T11:00:00Z");
const NEXT_WEEK = "2026-11-30";

/** `name=value` of the cookie the response sets. */
function cookieOf(res: request.Response, name: string) {
  const header = res.headers["set-cookie"] as unknown as string[];
  return header.find((c) => c.startsWith(`${name}=`))!.split(";")[0];
}

/** Creates an employee through the owner API and logs them in to the employee app. */
async function addEmployee(
  setup: { ownerCookie: string; contractId: number; restaurantId: number },
  firstName: string,
  dateOfBirth: string
) {
  const created = await request(app)
    .post("/api/employees")
    .set("Cookie", setup.ownerCookie)
    .send({
      firstName,
      lastName: "Schmidt",
      email: `${firstName.toLowerCase()}@example.com`,
      dateOfBirth,
      contractId: setup.contractId,
      defaultRestaurantId: setup.restaurantId,
    });
  // How an employee gets their first password belongs to the employee feature,
  // which is not part of this excerpt. The test gives the account a known one.
  await db
    .update(appUser)
    .set({ passwordHash: TEST_PASSWORD_HASH })
    .where(eq(appUser.username, created.body.employee.username));
  const login = await request(app)
    .post("/api/employees/login")
    .send({
      username: created.body.employee.username,
      password: TEST_PASSWORD,
    });
  return {
    employeeId: created.body.employee.id as number,
    cookie: cookieOf(login, "employee_session"),
  };
}

/**
 * An owner with a restaurant that is open Monday to Saturday (closed on
 * Sunday), the shifts Früh and Spät, a part-time contract and Anna on it,
 * logged in to the employee app.
 */
async function setUpSubmission() {
  const ownerCookie = await signInOwner();
  const ownerId = await ownerIdOf("owner@example.com");
  const [{ id: restaurantId }] = await db
    .insert(restaurant)
    .values({ name: "Zentrum", colour: "teal", ownerId })
    .returning({ id: restaurant.id });
  await db.insert(restaurantOpeningHours).values(
    [1, 2, 3, 4, 5, 6].map((weekday) => ({
      restaurantId,
      weekday,
      openTime: "11:00",
      closeTime: "23:00",
    }))
  );
  const [{ id: contractId }] = await db
    .insert(contract)
    .values({
      ownerId,
      contractName: "Teilzeit",
      maxWeeklyHours: 20,
      submitsAvailability: true,
    })
    .returning({ id: contract.id });
  const shiftId = async (
    name: string,
    startTime: string,
    endTime: string,
    shade: "early" | "late"
  ) =>
    (
      await request(app)
        .post("/api/shifts")
        .set("Cookie", ownerCookie)
        .send({ name, startTime, endTime, shade })
    ).body.shift.id as number;
  const frueh = await shiftId("Früh", "11:00", "17:00", "early");
  const spaet = await shiftId("Spät", "17:00", "23:00", "late");

  const setup = { ownerCookie, ownerId, restaurantId, contractId, frueh, spaet };
  const anna = await addEmployee(setup, "Anna", "1998-03-13");
  return { ...setup, anna };
}

function submit(cookie: string | undefined, body: object) {
  const req = request(app).post("/api/availability");
  if (cookie) req.set("Cookie", cookie);
  return req.send(body);
}

const weeks = () => db.select().from(availability).orderBy(asc(availability.weekStart));
const daysOf = () =>
  db
    .select({
      weekday: availabilityDay.weekday,
      shiftId: availabilityDay.shiftId,
      dismissedAt: availabilityDay.dismissedAt,
    })
    .from(availabilityDay)
    .orderBy(asc(availabilityDay.weekday));

describe("POST /api/availability", () => {
  beforeEach(() => {
    // Only Date is faked, so timers in supertest and pg keep running.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(FRIDAY_NOON);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("auth", () => {
    it("returns 401 without a session cookie", async () => {
      await setUpSubmission();

      const res = await submit(undefined, { days: [] });

      expect(res.status).toBe(401);
      expect(await weeks()).toHaveLength(0);
    });

    it("returns 401 for the owner's session", async () => {
      const s = await setUpSubmission();

      const res = await submit(s.ownerCookie, { days: [] });

      expect(res.status).toBe(401);
      expect(await weeks()).toHaveLength(0);
    });

    it("returns 401 for an owner's token in the employee cookie", async () => {
      const s = await setUpSubmission();
      const token = s.ownerCookie.slice("session=".length);

      const res = await submit(`employee_session=${token}`, { days: [] });

      expect(res.status).toBe(401);
      expect(await weeks()).toHaveLength(0);
    });
  });

  describe("saving", () => {
    it("creates next week's availability on the first save", async () => {
      const s = await setUpSubmission();

      const res = await submit(s.anna.cookie, {
        days: [
          { weekday: 3, shiftId: s.spaet },
          { weekday: 1, shiftId: s.frueh },
        ],
        note: "  Only from 12:00 on Monday  ",
      });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        availability: {
          weekStart: NEXT_WEEK,
          note: "Only from 12:00 on Monday",
          days: [
            { weekday: 1, shiftId: s.frueh },
            { weekday: 3, shiftId: s.spaet },
          ],
          savesLeft: 2,
        },
      });

      const [week] = await weeks();
      expect(week).toMatchObject({
        employeeId: s.anna.employeeId,
        ownerId: s.ownerId,
        weekStart: NEXT_WEEK,
        note: "Only from 12:00 on Monday",
        saveCount: 1,
      });
      expect(await daysOf()).toEqual([
        { weekday: 1, shiftId: s.frueh, dismissedAt: null },
        { weekday: 3, shiftId: s.spaet, dismissedAt: null },
      ]);
    });

    it("replaces the days and the note on the next save and counts it", async () => {
      const s = await setUpSubmission();
      await submit(s.anna.cookie, {
        days: [{ weekday: 1, shiftId: s.frueh }],
        note: "First try",
      });

      const res = await submit(s.anna.cookie, {
        days: [{ weekday: 2, shiftId: s.spaet }],
      });

      expect(res.status).toBe(200);
      expect(res.body.availability).toEqual({
        weekStart: NEXT_WEEK,
        note: null,
        days: [{ weekday: 2, shiftId: s.spaet }],
        savesLeft: 1,
      });
      const rows = await weeks();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ note: null, saveCount: 2 });
      expect(await daysOf()).toEqual([
        { weekday: 2, shiftId: s.spaet, dismissedAt: null },
      ]);
    });

    it("keeps a dismissed day only while its shift is unchanged", async () => {
      const s = await setUpSubmission();
      await submit(s.anna.cookie, {
        days: [
          { weekday: 1, shiftId: s.frueh },
          { weekday: 2, shiftId: s.frueh },
        ],
      });
      const dismissedAt = new Date("2026-11-27T10:00:00Z");
      await db.update(availabilityDay).set({ dismissedAt });

      await submit(s.anna.cookie, {
        days: [
          { weekday: 1, shiftId: s.frueh }, // unchanged
          { weekday: 2, shiftId: s.spaet }, // other shift
          { weekday: 4, shiftId: s.frueh }, // new day
        ],
      });

      expect(await daysOf()).toEqual([
        { weekday: 1, shiftId: s.frueh, dismissedAt },
        { weekday: 2, shiftId: s.spaet, dismissedAt: null },
        { weekday: 4, shiftId: s.frueh, dismissedAt: null },
      ]);
    });

    it("accepts a week without any day, and it counts as a save", async () => {
      const s = await setUpSubmission();

      const res = await submit(s.anna.cookie, { days: [] });

      expect(res.status).toBe(201);
      expect(res.body.availability).toMatchObject({ days: [], savesLeft: 2 });
      expect(await weeks()).toHaveLength(1);
      expect(await daysOf()).toHaveLength(0);
    });

    it.each([
      ["an empty note", { note: "" }],
      ["a blank note", { note: "   " }],
      ["a null note", { note: null }],
      ["no note", {}],
    ])("stores no note for %s", async (_label, note) => {
      const s = await setUpSubmission();

      const res = await submit(s.anna.cookie, { days: [], ...note });

      expect(res.status).toBe(201);
      expect(res.body.availability.note).toBeNull();
      expect((await weeks())[0].note).toBeNull();
    });

    it("ignores an employeeId, ownerId and weekStart sent by the client", async () => {
      const s = await setUpSubmission();
      const ben = await addEmployee(s, "Ben", "1999-01-02");

      const res = await submit(s.anna.cookie, {
        days: [],
        employeeId: ben.employeeId,
        ownerId: 999,
        weekStart: "2026-12-07",
      });

      expect(res.status).toBe(201);
      expect(await weeks()).toEqual([
        expect.objectContaining({
          employeeId: s.anna.employeeId,
          ownerId: s.ownerId,
          weekStart: NEXT_WEEK,
        }),
      ]);
    });

    it("deletes weeks that ended more than two weeks ago, of anyone", async () => {
      const s = await setUpSubmission();
      const ben = await addEmployee(s, "Ben", "1999-01-02");
      await db.insert(availability).values([
        // Ended on 2026-11-08, 19 days ago: deleted.
        { employeeId: ben.employeeId, ownerId: s.ownerId, weekStart: "2026-11-02" },
        // Ended on 2026-11-15, 12 days ago: kept.
        { employeeId: ben.employeeId, ownerId: s.ownerId, weekStart: "2026-11-09" },
      ]);

      await submit(s.anna.cookie, { days: [] });

      expect((await weeks()).map((w) => w.weekStart)).toEqual([
        "2026-11-09",
        NEXT_WEEK,
      ]);
    });
  });

  describe("invalid input", () => {
    it.each([
      ["a weekday of 0", { days: [{ weekday: 0, shiftId: 1 }] }, "days"],
      ["a weekday of 8", { days: [{ weekday: 8, shiftId: 1 }] }, "days"],
      [
        "the same day twice",
        {
          days: [
            { weekday: 1, shiftId: 1 },
            { weekday: 1, shiftId: 1 },
          ],
        },
        "days",
      ],
      [
        "eight days",
        { days: [1, 2, 3, 4, 5, 6, 7, 1].map((weekday) => ({ weekday, shiftId: 1 })) },
        "days",
      ],
      ["a missing shift", { days: [{ weekday: 1 }] }, "days"],
      ["a shift id as text", { days: [{ weekday: 1, shiftId: "1" }] }, "days"],
      ["a shift id of 0", { days: [{ weekday: 1, shiftId: 0 }] }, "days"],
      ["no days", { note: "Hi" }, "days"],
      ["a note of 101 characters", { days: [], note: "x".repeat(101) }, "note"],
    ])("returns 400 for %s", async (_label, body, field) => {
      const s = await setUpSubmission();

      const res = await submit(s.anna.cookie, body);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid input");
      expect(res.body.fields).toHaveProperty(field);
      expect(await weeks()).toHaveLength(0);
    });

    it("returns 400 for a day the default restaurant is closed", async () => {
      const s = await setUpSubmission();

      const res = await submit(s.anna.cookie, {
        days: [
          { weekday: 1, shiftId: s.frueh },
          { weekday: 7, shiftId: s.frueh },
        ],
      });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: "Invalid input",
        fields: { days: ["Your restaurant is closed on Sunday"] },
      });
      expect(await weeks()).toHaveLength(0);
    });

    it("returns 400 for another owner's shift or an unknown shift", async () => {
      const s = await setUpSubmission();
      const other = await signInOwner("other@example.com");
      const foreign = await request(app)
        .post("/api/shifts")
        .set("Cookie", other)
        .send({ name: "Nacht", startTime: "22:00", endTime: "06:00", shade: "early" });

      for (const shiftId of [foreign.body.shift.id, 999_999]) {
        const res = await submit(s.anna.cookie, {
          days: [
            { weekday: 1, shiftId: s.frueh },
            { weekday: 2, shiftId },
          ],
        });

        expect(res.status).toBe(400);
        expect(res.body.fields).toEqual({
          days: ["Pick one of the listed shifts"],
        });
      }
      expect(await weeks()).toHaveLength(0);
    });
  });

  describe("the window", () => {
    const closedBody = {
      error: "The availability window is closed",
      window: {
        opensWeekday: 5,
        opensTime: "00:00",
        closesWeekday: 7,
        closesTime: "23:59",
      },
    };

    it.each([
      ["the minute before it opens (Thursday 23:59)", "2026-11-26T22:59:00Z"],
      ["the minute after it closes (Monday 00:00)", "2026-11-29T23:00:00Z"],
      // 23:30 UTC on Sunday is already Monday 00:30 in Berlin.
      ["Sunday 23:30 UTC", "2026-11-29T23:30:00Z"],
    ])("returns 409 at %s", async (_label, iso) => {
      const s = await setUpSubmission();
      vi.setSystemTime(new Date(iso));

      const res = await submit(s.anna.cookie, { days: [] });

      expect(res.status).toBe(409);
      expect(res.body).toEqual(closedBody);
      expect(await weeks()).toHaveLength(0);
    });

    it.each([
      ["the opening minute (Friday 00:00)", "2026-11-26T23:00:00Z"],
      ["the end of the closing minute (Sunday 23:59:30)", "2026-11-29T22:59:30Z"],
    ])("accepts a save at %s", async (_label, iso) => {
      const s = await setUpSubmission();
      vi.setSystemTime(new Date(iso));

      const res = await submit(s.anna.cookie, { days: [] });

      expect(res.status).toBe(201);
      expect(res.body.availability.weekStart).toBe(NEXT_WEEK);
    });

    it("uses the owner's own window", async () => {
      const s = await setUpSubmission();
      // Wednesday 08:30 to Thursday 20:00: closed on Friday.
      await putSettings(s.ownerCookie, custom);

      const closed = await submit(s.anna.cookie, { days: [] });
      vi.setSystemTime(new Date("2026-11-26T12:00:00Z")); // Thursday 13:00
      const open = await submit(s.anna.cookie, { days: [] });

      expect(closed.status).toBe(409);
      expect(closed.body.window).toEqual({
        opensWeekday: 3,
        opensTime: "08:30",
        closesWeekday: 4,
        closesTime: "20:00",
      });
      expect(open.status).toBe(201);
      expect(open.body.availability.savesLeft).toBe(4);
    });
  });

  describe("saves left", () => {
    it("returns 409 once all saves are used", async () => {
      const s = await setUpSubmission();
      for (const savesLeft of [2, 1, 0]) {
        const res = await submit(s.anna.cookie, { days: [] });
        expect(res.body.availability.savesLeft).toBe(savesLeft);
      }

      const res = await submit(s.anna.cookie, {
        days: [{ weekday: 1, shiftId: s.frueh }],
      });

      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: "You have no saves left this week" });
      expect((await weeks())[0].saveCount).toBe(3);
      expect(await daysOf()).toHaveLength(0);
    });

    it("returns 409 when the owner lowered the limit below the saves used", async () => {
      const s = await setUpSubmission();
      await putSettings(s.ownerCookie, { ...defaults, maxSaves: 5 });
      for (let i = 0; i < 3; i++) await submit(s.anna.cookie, { days: [] });
      await putSettings(s.ownerCookie, { ...defaults, maxSaves: 2 });

      const res = await submit(s.anna.cookie, { days: [] });

      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: "You have no saves left this week" });
      expect((await weeks())[0].saveCount).toBe(3);
    });
  });

  describe("saves at the same time", () => {
    // Regression test (see PROBLEMS.md): the submit transaction used to load
    // the availability settings on the global db instead of tx. Each save then
    // held one pool connection and waited for a second, so as many saves at
    // once as the pool has connections waited on each other until the
    // connection timeout and all failed with 500.
    it(
      "saves as many employees at once as the pool has connections",
      async () => {
        const s = await setUpSubmission();
        const poolSize = db.$client.options.max ?? 10;
        const names = [
          "Ben", "Cara", "Dana", "Emil", "Finn", "Greta", "Hugo", "Ida",
          "Jonas", "Lena", "Mia", "Noah", "Olga", "Paul", "Rosa",
        ];
        const others = await Promise.all(
          names
            .slice(0, poolSize - 1)
            .map((name, i) =>
              addEmployee(s, name, `1995-04-${String(i + 10).padStart(2, "0")}`)
            )
        );
        const cookies = [s.anna.cookie, ...others.map((e) => e.cookie)];
        expect(cookies).toHaveLength(poolSize);

        const responses = await Promise.all(
          cookies.map((cookie) =>
            submit(cookie, { days: [{ weekday: 1, shiftId: s.frueh }] })
          )
        );

        expect(responses.map((res) => res.status)).toEqual(
          cookies.map(() => 201)
        );
        expect(await weeks()).toHaveLength(poolSize);
      },
      // Long enough that the old bug fails on the 500s, not on the timeout.
      30_000
    );
  });
});

// --- GET /api/availability: the employee app's availability screen ---

function getAvailability(cookie?: string) {
  const req = request(app).get("/api/availability");
  if (cookie) req.set("Cookie", cookie);
  return req;
}

describe("GET /api/availability", () => {
  beforeEach(() => {
    // Only Date is faked, so timers in supertest and pg keep running.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(FRIDAY_NOON);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("auth", () => {
    it("returns 401 without a session cookie", async () => {
      await setUpSubmission();

      expect((await getAvailability()).status).toBe(401);
    });

    it("returns 401 for the owner's session", async () => {
      const s = await setUpSubmission();

      expect((await getAvailability(s.ownerCookie)).status).toBe(401);
    });

    it("returns 401 for an owner's token in the employee cookie", async () => {
      const s = await setUpSubmission();
      const token = s.ownerCookie.slice("session=".length);

      expect((await getAvailability(`employee_session=${token}`)).status).toBe(401);
    });

    it("returns 403 for an employee without a default restaurant", async () => {
      const s = await setUpSubmission();
      await db
        .update(employeeRestaurant)
        .set({ isDefault: false })
        .where(eq(employeeRestaurant.employeeId, s.anna.employeeId));

      const res = await getAvailability(s.anna.cookie);

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: "You can't submit availability" });
    });
  });

  it("returns next week's screen while the window is open and nothing is saved", async () => {
    const s = await setUpSubmission();
    // Created last, but starts first: shifts come by their default times.
    const mittag = (
      await request(app)
        .post("/api/shifts")
        .set("Cookie", s.ownerCookie)
        // The one shade Früh and Spät leave free.
        .send({ name: "Mittag", startTime: "08:00", endTime: "14:00", shade: "full" })
    ).body.shift.id;

    const res = await getAvailability(s.anna.cookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      availability: {
        weekStart: NEXT_WEEK,
        isOpen: true,
        window: {
          opensWeekday: 5,
          opensTime: "00:00",
          closesWeekday: 7,
          closesTime: "23:59",
        },
        nextOpening: null,
        maxSaves: 3,
        savesLeft: 3,
        restaurant: { id: s.restaurantId, name: "Zentrum" },
        // Closed on Sunday, so it isn't listed.
        days: [
          { weekday: 1, date: "2026-11-30" },
          { weekday: 2, date: "2026-12-01" },
          { weekday: 3, date: "2026-12-02" },
          { weekday: 4, date: "2026-12-03" },
          { weekday: 5, date: "2026-12-04" },
          { weekday: 6, date: "2026-12-05" },
        ],
        shifts: [
          { id: mittag, name: "Mittag" },
          { id: s.frueh, name: "Früh" },
          { id: s.spaet, name: "Spät" },
        ],
        submission: null,
      },
    });
  });

  it("returns the saved days and note, and the saves left", async () => {
    const s = await setUpSubmission();
    await submit(s.anna.cookie, {
      days: [
        { weekday: 4, shiftId: s.spaet },
        { weekday: 1, shiftId: s.frueh },
      ],
      note: "Only from 12:00 on Monday",
    });

    const res = await getAvailability(s.anna.cookie);

    expect(res.body.availability).toMatchObject({
      weekStart: NEXT_WEEK,
      savesLeft: 2,
      submission: {
        note: "Only from 12:00 on Monday",
        days: [
          { weekday: 1, shiftId: s.frueh },
          { weekday: 4, shiftId: s.spaet },
        ],
      },
    });
  });

  it("shows the submitted week read-only until the next window opens, then a fresh week", async () => {
    const s = await setUpSubmission();
    await submit(s.anna.cookie, { days: [{ weekday: 1, shiftId: s.frueh }] });

    // Thursday 2026-12-03 12:00 in Berlin: the week submitted for is running.
    vi.setSystemTime(new Date("2026-12-03T11:00:00Z"));
    const before = await getAvailability(s.anna.cookie);
    // Friday 2026-12-04 00:00 in Berlin: the next window has opened.
    vi.setSystemTime(new Date("2026-12-03T23:00:00Z"));
    const opened = await getAvailability(s.anna.cookie);

    expect(before.body.availability).toMatchObject({
      weekStart: NEXT_WEEK,
      isOpen: false,
      nextOpening: { date: "2026-12-04", time: "00:00" },
      savesLeft: 2,
      submission: { note: null, days: [{ weekday: 1, shiftId: s.frueh }] },
    });
    expect(opened.body.availability).toMatchObject({
      weekStart: "2026-12-07",
      isOpen: true,
      nextOpening: null,
      savesLeft: 3,
      submission: null,
    });
    expect(opened.body.availability.days[0]).toEqual({
      weekday: 1,
      date: "2026-12-07",
    });
  });

  it("keeps showing the submitted week after a mid-week window closed", async () => {
    const s = await setUpSubmission();
    // Wednesday 08:30 to Thursday 20:00, 5 saves.
    await putSettings(s.ownerCookie, custom);
    vi.setSystemTime(new Date("2026-11-26T11:00:00Z")); // Thursday 12:00
    await submit(s.anna.cookie, { days: [{ weekday: 2, shiftId: s.spaet }] });

    vi.setSystemTime(FRIDAY_NOON);
    const res = await getAvailability(s.anna.cookie);

    expect(res.body.availability).toMatchObject({
      weekStart: NEXT_WEEK,
      isOpen: false,
      nextOpening: { date: "2026-12-02", time: "08:30" },
      maxSaves: 5,
      savesLeft: 4,
      submission: { days: [{ weekday: 2, shiftId: s.spaet }] },
    });
  });

  it("returns a saved day as it is after the restaurant closed on it", async () => {
    const s = await setUpSubmission();
    await submit(s.anna.cookie, { days: [{ weekday: 1, shiftId: s.frueh }] });
    await db
      .delete(restaurantOpeningHours)
      .where(
        and(
          eq(restaurantOpeningHours.restaurantId, s.restaurantId),
          eq(restaurantOpeningHours.weekday, 1)
        )
      );

    const res = await getAvailability(s.anna.cookie);

    expect(res.body.availability.days.map((d: { weekday: number }) => d.weekday)).toEqual([
      2, 3, 4, 5, 6,
    ]);
    expect(res.body.availability.submission.days).toEqual([
      { weekday: 1, shiftId: s.frueh },
    ]);
  });

  it("never shows another employee's submission or another owner's shifts", async () => {
    const s = await setUpSubmission();
    const ben = await addEmployee(s, "Ben", "1999-01-02");
    await submit(ben.cookie, { days: [{ weekday: 1, shiftId: s.frueh }] });
    const other = await signInOwner("other@example.com");
    await request(app)
      .post("/api/shifts")
      .set("Cookie", other)
      .send({ name: "Nacht", startTime: "22:00", endTime: "06:00", shade: "early" });

    const res = await getAvailability(s.anna.cookie);

    expect(res.body.availability.submission).toBeNull();
    expect(res.body.availability.savesLeft).toBe(3);
    expect(res.body.availability.shifts.map((x: { name: string }) => x.name)).toEqual([
      "Früh",
      "Spät",
    ]);
  });

  it("never returns negative saves left after the owner lowered the limit", async () => {
    const s = await setUpSubmission();
    await putSettings(s.ownerCookie, { ...defaults, maxSaves: 5 });
    for (let i = 0; i < 3; i++) await submit(s.anna.cookie, { days: [] });
    await putSettings(s.ownerCookie, { ...defaults, maxSaves: 2 });

    const res = await getAvailability(s.anna.cookie);

    expect(res.body.availability).toMatchObject({ maxSaves: 2, savesLeft: 0 });
  });
});

// --- POST /api/availability/dismiss: the owner hides one day's hint ---

function dismiss(cookie: string | undefined, body: object) {
  const req = request(app).post("/api/availability/dismiss");
  if (cookie) req.set("Cookie", cookie);
  return req.send(body);
}

describe("POST /api/availability/dismiss", () => {
  // Anna's next week (from 2026-11-30): Früh on Monday, Spät on Wednesday.
  async function setUpDismiss() {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(FRIDAY_NOON);
    const s = await setUpSubmission();
    await submit(s.anna.cookie, {
      days: [
        { weekday: 1, shiftId: s.frueh },
        { weekday: 3, shiftId: s.spaet },
      ],
    });
    vi.useRealTimers();
    return s;
  }

  const MONDAY = NEXT_WEEK;
  const TUESDAY = "2026-12-01";

  it("dismisses that day only, and the schedule no longer shows it", async () => {
    const s = await setUpDismiss();

    const res = await dismiss(s.ownerCookie, {
      employeeId: s.anna.employeeId,
      date: MONDAY,
    });

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
    const days = await daysOf();
    expect(days[0].dismissedAt).toBeInstanceOf(Date);
    expect(days[1]).toEqual({ weekday: 3, shiftId: s.spaet, dismissedAt: null });

    const week = await request(app)
      .get("/api/schedules")
      .query({ restaurantId: s.restaurantId, weekStart: NEXT_WEEK })
      .set("Cookie", s.ownerCookie);
    expect(week.body.schedule.availability).toEqual([
      {
        employeeId: s.anna.employeeId,
        note: null,
        days: [{ date: "2026-12-02", shiftId: s.spaet }],
      },
    ]);
  });

  it("keeps the first time when a day is dismissed twice", async () => {
    const s = await setUpDismiss();
    const body = { employeeId: s.anna.employeeId, date: MONDAY };
    await dismiss(s.ownerCookie, body);
    const [first] = await daysOf();

    const res = await dismiss(s.ownerCookie, body);

    expect(res.status).toBe(204);
    const [again] = await daysOf();
    expect(again.dismissedAt).toEqual(first.dismissedAt);
  });

  it.each([
    ["a day without availability", TUESDAY],
    ["the same weekday in another week", "2026-12-07"],
  ])("returns 404 for %s", async (_label, date) => {
    const s = await setUpDismiss();

    const res = await dismiss(s.ownerCookie, {
      employeeId: s.anna.employeeId,
      date,
    });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Availability not found" });
    for (const day of await daysOf()) expect(day.dismissedAt).toBeNull();
  });

  it("returns 404 for another owner's employee and changes nothing", async () => {
    const s = await setUpDismiss();
    const other = await signInOwner("other@example.com");

    const res = await dismiss(other, {
      employeeId: s.anna.employeeId,
      date: MONDAY,
    });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Availability not found" });
    for (const day of await daysOf()) expect(day.dismissedAt).toBeNull();
  });

  it.each([
    ["a missing employee", { date: MONDAY }, "employeeId"],
    ["an employee id that isn't one", { employeeId: "7", date: MONDAY }, "employeeId"],
    ["a missing date", { employeeId: 1 }, "date"],
    ["a date that doesn't exist", { employeeId: 1, date: "2026-02-30" }, "date"],
    ["a badly formatted date", { employeeId: 1, date: "30.11.2026" }, "date"],
  ])("returns 400 for %s", async (_label, body, field) => {
    const s = await setUpDismiss();

    const res = await dismiss(s.ownerCookie, body);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid input");
    expect(res.body.fields).toHaveProperty(field);
  });

  it("returns 401 without a session and for the employee's session", async () => {
    const s = await setUpDismiss();
    const body = { employeeId: s.anna.employeeId, date: MONDAY };

    const responses = [
      await dismiss(undefined, body),
      await dismiss(s.anna.cookie, body),
    ];

    for (const res of responses) expect(res.status).toBe(401);
    for (const day of await daysOf()) expect(day.dismissedAt).toBeNull();
  });

});
