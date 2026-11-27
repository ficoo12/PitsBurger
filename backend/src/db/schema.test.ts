import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  appUser,
  availability,
  availabilityDay,
  availabilitySettings,
  contract,
  employee,
  employeeRestaurant,
  position,
  restaurant,
  restaurantShift,
  schedule,
  scheduleEntry,
  shift,
} from "./schema.js";
import { db, resetDatabase, closeDatabase } from "../../test/db.js";

// Checks the constraints of the employee, schedule and availability tables
// directly in the database, without going through the API.

const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";
const CHECK_VIOLATION = "23514";

// Monday 05.10.2026, the week of the Excel sheets.
const WEEK = "2026-10-05";
const MONDAY = "2026-10-05";
const TUESDAY = "2026-10-06";

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

/** The Postgres error code a query was rejected with, e.g. "23505". */
async function pgErrorCode(query: PromiseLike<unknown>) {
  try {
    await query;
  } catch (err) {
    const e = err as { code?: string; cause?: { code?: string } };
    return e.cause?.code ?? e.code;
  }
  return undefined;
}

async function insertUser(email: string, role: "owner" | "employee") {
  const [{ id }] = await db
    .insert(appUser)
    .values({ email, role, passwordHash: "not-a-real-hash" })
    .returning({ id: appUser.id });
  return id;
}

async function insertRestaurant(
  ownerId: number,
  name: string,
  colour: (typeof restaurant.$inferInsert)["colour"]
) {
  const [{ id }] = await db
    .insert(restaurant)
    .values({ ownerId, name, colour })
    .returning({ id: restaurant.id });
  return id;
}

async function insertEmployee(userId: number, ownerId: number, contractId: number) {
  const [{ id }] = await db
    .insert(employee)
    .values({ userId, ownerId, contractId, dateOfBirth: "2000-01-31" })
    .returning({ id: employee.id });
  return id;
}

/** Lets the employee work in the restaurant. */
function linkRestaurant(
  employeeId: number,
  restaurantId: number,
  ownerId: number,
  isDefault = false
) {
  return db
    .insert(employeeRestaurant)
    .values({ employeeId, restaurantId, ownerId, isDefault });
}

async function insertShift(
  ownerId: number,
  name: string,
  shade: (typeof shift.$inferInsert)["shade"]
) {
  const [{ id }] = await db
    .insert(shift)
    .values({ ownerId, name, startTime: "11:00", endTime: "17:00", shade })
    .returning({ id: shift.id });
  return id;
}

/** Gives a restaurant one of the owner's shifts, with its default times. */
async function addShiftToRestaurant(
  restaurantId: number,
  shiftId: number,
  ownerId: number
) {
  await db.insert(restaurantShift).values({ restaurantId, shiftId, ownerId });
}

async function insertSchedule(restaurantId: number, weekStart = WEEK) {
  const [{ id }] = await db
    .insert(schedule)
    .values({ restaurantId, weekStart })
    .returning({ id: schedule.id });
  return id;
}

/**
 * One owner with two restaurants (Riverside, Harbour), each with a schedule
 * for WEEK. The owner has the shifts Früh and Spät; Harbour has both,
 * Riverside only Früh. (The API gives every restaurant every shift; the
 * database alone doesn't require it.) Mohammad works in both restaurants
 * (Riverside is his default); Anduena works only in Riverside.
 */
async function setUp() {
  const ownerId = await insertUser("owner@example.com", "owner");
  const [{ id: contractId }] = await db
    .insert(contract)
    .values({ ownerId, contractName: "Minijob", maxWeeklyHours: 10 })
    .returning({ id: contract.id });

  const riverside = await insertRestaurant(ownerId, "Riverside", "teal");
  const harbour = await insertRestaurant(ownerId, "Harbour", "green");

  const mohammadUser = await insertUser("mohammad@example.com", "employee");
  const anduenaUser = await insertUser("anduena@example.com", "employee");
  const mohammad = await insertEmployee(mohammadUser, ownerId, contractId);
  const anduena = await insertEmployee(anduenaUser, ownerId, contractId);
  await linkRestaurant(mohammad, riverside, ownerId, true);
  await linkRestaurant(mohammad, harbour, ownerId);
  await linkRestaurant(anduena, riverside, ownerId, true);

  const frueh = await insertShift(ownerId, "Früh", "early");
  const spaet = await insertShift(ownerId, "Spät", "late");
  await addShiftToRestaurant(riverside, frueh, ownerId);
  await addShiftToRestaurant(harbour, frueh, ownerId);
  await addShiftToRestaurant(harbour, spaet, ownerId);

  return {
    ownerId,
    contractId,
    riverside,
    harbour,
    mohammad,
    anduena,
    frueh,
    spaet,
    scheduleRiverside: await insertSchedule(riverside),
    scheduleHarbour: await insertSchedule(harbour),
  };
}

type Fixture = Awaited<ReturnType<typeof setUp>>;

/** A valid entry: Mohammad works Früh in Riverside on Monday. */
function riversideEntry(
  f: Fixture,
  changes: Partial<typeof scheduleEntry.$inferInsert> = {}
): typeof scheduleEntry.$inferInsert {
  return {
    scheduleId: f.scheduleRiverside,
    employeeId: f.mohammad,
    shiftId: f.frueh,
    workDate: MONDAY,
    restaurantId: f.riverside,
    weekStart: WEEK,
    ...changes,
  };
}

/** A valid entry: Mohammad works Spät in Harbour on Tuesday. */
function harbourEntry(
  f: Fixture,
  changes: Partial<typeof scheduleEntry.$inferInsert> = {}
): typeof scheduleEntry.$inferInsert {
  return {
    scheduleId: f.scheduleHarbour,
    employeeId: f.mohammad,
    shiftId: f.spaet,
    workDate: TUESDAY,
    restaurantId: f.harbour,
    weekStart: WEEK,
    ...changes,
  };
}

/** Mohammad's availability for a week; returns its id. */
async function insertAvailability(
  f: Fixture,
  changes: Partial<typeof availability.$inferInsert> = {}
) {
  const [{ id }] = await db
    .insert(availability)
    .values({
      employeeId: f.mohammad,
      ownerId: f.ownerId,
      weekStart: WEEK,
      ...changes,
    })
    .returning({ id: availability.id });
  return id;
}

/** A day Mohammad can work, with the shift he picked. */
function insertDay(
  f: Fixture,
  availabilityId: number,
  changes: Partial<typeof availabilityDay.$inferInsert> = {}
) {
  return db.insert(availabilityDay).values({
    availabilityId,
    weekday: 1,
    shiftId: f.frueh,
    ownerId: f.ownerId,
    ...changes,
  });
}

describe("employee", () => {
  it("allows one employee per account", async () => {
    const f = await setUp();
    const [{ userId }] = await db
      .select({ userId: employee.userId })
      .from(employee)
      .where(eq(employee.id, f.mohammad));

    expect(await pgErrorCode(insertEmployee(userId, f.ownerId, f.contractId))).toBe(
      UNIQUE_VIOLATION
    );
  });

  it("rejects a contract of another owner", async () => {
    const f = await setUp();
    const otherOwner = await insertUser("other@example.com", "owner");
    const user = await insertUser("anna@example.com", "employee");

    expect(await pgErrorCode(insertEmployee(user, otherOwner, f.contractId))).toBe(
      FOREIGN_KEY_VIOLATION
    );
  });
});

describe("employee_restaurant", () => {
  it("allows at most one default restaurant per employee", async () => {
    const f = await setUp();
    const query = db
      .update(employeeRestaurant)
      .set({ isDefault: true })
      .where(
        and(
          eq(employeeRestaurant.employeeId, f.mohammad),
          eq(employeeRestaurant.restaurantId, f.harbour)
        )
      );
    expect(await pgErrorCode(query)).toBe(UNIQUE_VIOLATION);
  });

  it("allows each restaurant only once per employee", async () => {
    const f = await setUp();
    expect(await pgErrorCode(linkRestaurant(f.anduena, f.riverside, f.ownerId))).toBe(
      UNIQUE_VIOLATION
    );
  });

  it("rejects a restaurant of another owner", async () => {
    const f = await setUp();
    const otherOwner = await insertUser("other@example.com", "owner");
    const otherRestaurant = await insertRestaurant(otherOwner, "Not mine", "teal");

    expect(
      await pgErrorCode(linkRestaurant(f.anduena, otherRestaurant, f.ownerId))
    ).toBe(FOREIGN_KEY_VIOLATION);
    // Same, with owner_id faked to match the restaurant.
    expect(
      await pgErrorCode(linkRestaurant(f.anduena, otherRestaurant, otherOwner))
    ).toBe(FOREIGN_KEY_VIOLATION);
  });
});

describe("schedule", () => {
  it("rejects a week that doesn't start on a Monday", async () => {
    const f = await setUp();
    expect(await pgErrorCode(insertSchedule(f.riverside, TUESDAY))).toBe(
      CHECK_VIOLATION
    );
  });

  it("allows only one schedule per restaurant and week", async () => {
    const f = await setUp();
    expect(await pgErrorCode(insertSchedule(f.riverside))).toBe(
      UNIQUE_VIOLATION
    );
  });
});

describe("position", () => {
  function insertPosition(
    ownerId: number,
    name: string,
    colour: (typeof position.$inferInsert)["colour"]
  ) {
    return db.insert(position).values({ ownerId, name, colour });
  }

  it("allows each colour only once per owner", async () => {
    const ownerId = await insertUser("owner@example.com", "owner");
    await insertPosition(ownerId, "Service", "red");
    await insertPosition(ownerId, "Kitchen", "yellow");
    expect(await pgErrorCode(insertPosition(ownerId, "Kasse", "red"))).toBe(
      UNIQUE_VIOLATION
    );
    // The same colour for another owner is fine.
    const otherOwner = await insertUser("other@example.com", "owner");
    await insertPosition(otherOwner, "Service", "red");
  });

  it("still allows each name only once per owner", async () => {
    const ownerId = await insertUser("owner@example.com", "owner");
    await insertPosition(ownerId, "Service", "red");
    expect(await pgErrorCode(insertPosition(ownerId, "Service", "pink"))).toBe(
      UNIQUE_VIOLATION
    );
  });
});

describe("restaurant", () => {
  it("allows each colour only once per owner", async () => {
    const ownerId = await insertUser("owner@example.com", "owner");
    await insertRestaurant(ownerId, "Riverside", "teal");
    expect(
      await pgErrorCode(insertRestaurant(ownerId, "Harbour", "teal"))
    ).toBe(UNIQUE_VIOLATION);
    // The same colour for another owner is fine.
    const otherOwner = await insertUser("other@example.com", "owner");
    await insertRestaurant(otherOwner, "Riverside", "teal");
  });
});

describe("shift", () => {
  it("allows each shade only once per owner", async () => {
    const f = await setUp();
    // setUp's owner has Früh (early) and Spät (late).
    expect(await pgErrorCode(insertShift(f.ownerId, "Mittag", "early"))).toBe(
      UNIQUE_VIOLATION
    );
    await insertShift(f.ownerId, "Ganz", "full");
    // The same shade for another owner is fine.
    const otherOwner = await insertUser("other@example.com", "owner");
    await insertShift(otherOwner, "Früh", "early");
  });

  it("allows each name only once per owner", async () => {
    const f = await setUp();
    // A free shade, so only the name is taken.
    expect(await pgErrorCode(insertShift(f.ownerId, "Früh", "full"))).toBe(
      UNIQUE_VIOLATION
    );
    // The same name for another owner is fine.
    const otherOwner = await insertUser("other@example.com", "owner");
    await insertShift(otherOwner, "Früh", "early");
  });

  it("rejects a shift that starts and ends at the same time", async () => {
    const f = await setUp();
    const query = db.insert(shift).values({
      ownerId: f.ownerId,
      name: "Ganz",
      startTime: "11:00",
      endTime: "11:00",
      shade: "full",
    });
    expect(await pgErrorCode(query)).toBe(CHECK_VIOLATION);
  });
});

describe("restaurant_shift", () => {
  it("stores a restaurant's own times for a shift", async () => {
    const f = await setUp();
    // Harbour's Früh runs 09:00–17:00 instead of the default 11:00–17:00.
    await db
      .update(restaurantShift)
      .set({ startTime: "09:00", endTime: "17:00" })
      .where(eq(restaurantShift.restaurantId, f.harbour));

    const rows = await db
      .select({
        restaurantId: restaurantShift.restaurantId,
        startTime: restaurantShift.startTime,
      })
      .from(restaurantShift)
      .where(eq(restaurantShift.shiftId, f.frueh));
    expect(rows).toEqual(
      expect.arrayContaining([
        { restaurantId: f.riverside, startTime: null },
        { restaurantId: f.harbour, startTime: "09:00:00" },
      ])
    );
  });

  it("allows each shift only once per restaurant", async () => {
    const f = await setUp();
    expect(
      await pgErrorCode(addShiftToRestaurant(f.riverside, f.frueh, f.ownerId))
    ).toBe(UNIQUE_VIOLATION);
  });

  it("rejects a shift of another owner", async () => {
    const f = await setUp();
    const otherOwner = await insertUser("other@example.com", "owner");
    const otherShift = await insertShift(otherOwner, "Ganz", "full");

    expect(
      await pgErrorCode(addShiftToRestaurant(f.riverside, otherShift, f.ownerId))
    ).toBe(FOREIGN_KEY_VIOLATION);
    // Same, with owner_id faked to match the shift.
    expect(
      await pgErrorCode(addShiftToRestaurant(f.riverside, otherShift, otherOwner))
    ).toBe(FOREIGN_KEY_VIOLATION);
  });

  it("rejects changing only one of the two times", async () => {
    const f = await setUp();
    for (const times of [{ startTime: "09:00" }, { endTime: "18:00" }]) {
      const query = db
        .update(restaurantShift)
        .set(times)
        .where(eq(restaurantShift.restaurantId, f.riverside));
      expect(await pgErrorCode(query)).toBe(CHECK_VIOLATION);
    }
  });

  it("rejects own times that start and end at the same time", async () => {
    const f = await setUp();
    const query = db
      .update(restaurantShift)
      .set({ startTime: "12:00", endTime: "12:00" })
      .where(eq(restaurantShift.restaurantId, f.riverside));
    expect(await pgErrorCode(query)).toBe(CHECK_VIOLATION);
  });
});

describe("schedule_entry", () => {
  it("stores an entry with changed times and a note", async () => {
    const f = await setUp();
    // Excel: "Früh ab 12 - 18 | 181"
    await db
      .insert(scheduleEntry)
      .values(
        riversideEntry(f, { startTime: "12:00", endTime: "18:00", note: "181" })
      );

    const [row] = await db.select().from(scheduleEntry);
    expect(row).toMatchObject({
      workDate: MONDAY,
      startTime: "12:00:00",
      endTime: "18:00:00",
      note: "181",
    });
  });

  it("rejects changed times that start and end at the same time", async () => {
    const f = await setUp();
    const query = db
      .insert(scheduleEntry)
      .values(riversideEntry(f, { startTime: "18:00", endTime: "18:00" }));
    expect(await pgErrorCode(query)).toBe(CHECK_VIOLATION);
  });

  it("rejects a work date outside the schedule's week", async () => {
    const f = await setUp();
    for (const workDate of ["2026-10-04", "2026-10-12"]) {
      const query = db
        .insert(scheduleEntry)
        .values(riversideEntry(f, { workDate }));
      expect(await pgErrorCode(query)).toBe(CHECK_VIOLATION);
    }
    // Sunday is the last day of the week.
    await db
      .insert(scheduleEntry)
      .values(riversideEntry(f, { workDate: "2026-10-11" }));
  });

  it("rejects a week_start that isn't the schedule's week", async () => {
    const f = await setUp();
    const query = db
      .insert(scheduleEntry)
      .values(
        riversideEntry(f, { weekStart: "2026-10-12", workDate: "2026-10-12" })
      );
    expect(await pgErrorCode(query)).toBe(FOREIGN_KEY_VIOLATION);
  });

  it("books a person at most once per day, across all restaurants", async () => {
    const f = await setUp();
    await db.insert(scheduleEntry).values(riversideEntry(f));

    // Same day, other restaurant.
    const query = db
      .insert(scheduleEntry)
      .values(harbourEntry(f, { workDate: MONDAY }));
    expect(await pgErrorCode(query)).toBe(UNIQUE_VIOLATION);

    // Another day in the other restaurant, and another person on the same day.
    await db.insert(scheduleEntry).values(harbourEntry(f));
    await db
      .insert(scheduleEntry)
      .values(riversideEntry(f, { employeeId: f.anduena }));
  });

  it("rejects an employee who doesn't work in the restaurant", async () => {
    const f = await setUp();
    // Anduena works only in Riverside.
    const query = db
      .insert(scheduleEntry)
      .values(harbourEntry(f, { employeeId: f.anduena }));
    expect(await pgErrorCode(query)).toBe(FOREIGN_KEY_VIOLATION);
  });

  it("rejects a shift the restaurant doesn't have", async () => {
    const f = await setUp();
    // The owner has Spät, but Riverside doesn't.
    const query = db
      .insert(scheduleEntry)
      .values(riversideEntry(f, { shiftId: f.spaet }));
    expect(await pgErrorCode(query)).toBe(FOREIGN_KEY_VIOLATION);
  });
});

describe("availability_settings", () => {
  it("stores one row per owner", async () => {
    const f = await setUp();
    const settings = {
      ownerId: f.ownerId,
      opensWeekday: 5,
      opensTime: "00:00",
      closesWeekday: 7,
      closesTime: "23:59",
      maxSaves: 3,
    };
    await db.insert(availabilitySettings).values(settings);

    expect(
      await pgErrorCode(db.insert(availabilitySettings).values(settings))
    ).toBe(UNIQUE_VIOLATION);
  });

  it.each([
    ["an opening weekday of 0", { opensWeekday: 0 }],
    ["a closing weekday of 8", { closesWeekday: 8 }],
    ["0 saves", { maxSaves: 0 }],
    ["6 saves", { maxSaves: 6 }],
  ])("rejects %s", async (_label, changes) => {
    const f = await setUp();
    const query = db.insert(availabilitySettings).values({
      ownerId: f.ownerId,
      opensWeekday: 5,
      opensTime: "00:00",
      closesWeekday: 7,
      closesTime: "23:59",
      maxSaves: 3,
      ...changes,
    });
    expect(await pgErrorCode(query)).toBe(CHECK_VIOLATION);
  });
});

describe("availability", () => {
  it("stores a week with a note and the days with their shifts", async () => {
    const f = await setUp();
    const id = await insertAvailability(f, {
      note: "I can work Monday morning, but only from 11:00.",
    });
    await insertDay(f, id, { weekday: 1 });
    await insertDay(f, id, { weekday: 3, shiftId: f.spaet });

    const [week] = await db.select().from(availability);
    expect(week).toMatchObject({ weekStart: WEEK, saveCount: 1 });
    const days = await db
      .select({ weekday: availabilityDay.weekday, shiftId: availabilityDay.shiftId })
      .from(availabilityDay)
      .orderBy(availabilityDay.weekday);
    expect(days).toEqual([
      { weekday: 1, shiftId: f.frueh },
      { weekday: 3, shiftId: f.spaet },
    ]);
  });

  it("allows one row per employee and week", async () => {
    const f = await setUp();
    await insertAvailability(f);

    expect(await pgErrorCode(insertAvailability(f))).toBe(UNIQUE_VIOLATION);
    // Another week is fine.
    await insertAvailability(f, { weekStart: "2026-10-12" });
  });

  it("rejects a week that doesn't start on a Monday", async () => {
    const f = await setUp();
    expect(
      await pgErrorCode(insertAvailability(f, { weekStart: TUESDAY }))
    ).toBe(CHECK_VIOLATION);
  });

  it("allows a note of up to 100 characters", async () => {
    const f = await setUp();
    await insertAvailability(f, { note: "x".repeat(100) });

    expect(
      await pgErrorCode(
        insertAvailability(f, { weekStart: "2026-10-12", note: "x".repeat(101) })
      )
    ).toBe(CHECK_VIOLATION);
  });

  it("rejects a save count below 1", async () => {
    const f = await setUp();
    expect(await pgErrorCode(insertAvailability(f, { saveCount: 0 }))).toBe(
      CHECK_VIOLATION
    );
  });

  it("rejects an employee of another owner", async () => {
    const f = await setUp();
    const otherOwner = await insertUser("other@example.com", "owner");

    expect(
      await pgErrorCode(insertAvailability(f, { ownerId: otherOwner }))
    ).toBe(FOREIGN_KEY_VIOLATION);
  });
});

describe("availability_day", () => {
  it("allows each weekday once per week", async () => {
    const f = await setUp();
    const id = await insertAvailability(f);
    await insertDay(f, id);

    expect(await pgErrorCode(insertDay(f, id, { shiftId: f.spaet }))).toBe(
      UNIQUE_VIOLATION
    );
  });

  it.each([0, 8])("rejects the weekday %i", async (weekday) => {
    const f = await setUp();
    const id = await insertAvailability(f);

    expect(await pgErrorCode(insertDay(f, id, { weekday }))).toBe(
      CHECK_VIOLATION
    );
  });

  it("rejects a shift of another owner", async () => {
    const f = await setUp();
    const id = await insertAvailability(f);
    const otherOwner = await insertUser("other@example.com", "owner");
    const otherShift = await insertShift(otherOwner, "Ganz", "full");

    expect(await pgErrorCode(insertDay(f, id, { shiftId: otherShift }))).toBe(
      FOREIGN_KEY_VIOLATION
    );
    // Same, with owner_id faked to match the shift.
    expect(
      await pgErrorCode(
        insertDay(f, id, { shiftId: otherShift, ownerId: otherOwner })
      )
    ).toBe(FOREIGN_KEY_VIOLATION);
  });

  it("stores when the owner dismissed the hint", async () => {
    const f = await setUp();
    const id = await insertAvailability(f);
    await insertDay(f, id);

    const dismissedAt = new Date("2026-10-03T10:00:00Z");
    await db.update(availabilityDay).set({ dismissedAt });

    const [day] = await db.select().from(availabilityDay);
    expect(day.dismissedAt).toEqual(dismissedAt);
  });
});

describe("deleting", () => {
  it("blocks deleting a shift that is used in a schedule", async () => {
    const f = await setUp();
    await db.insert(scheduleEntry).values(riversideEntry(f));

    const query = db.delete(shift).where(eq(shift.id, f.frueh));
    expect(await pgErrorCode(query)).toBe(FOREIGN_KEY_VIOLATION);
  });

  it("blocks deleting a shift that is picked in availability", async () => {
    const f = await setUp();
    const id = await insertAvailability(f);
    await insertDay(f, id, { shiftId: f.spaet });

    const query = db.delete(shift).where(eq(shift.id, f.spaet));
    expect(await pgErrorCode(query)).toBe(FOREIGN_KEY_VIOLATION);
  });

  it("removes an unused shift from every restaurant", async () => {
    const f = await setUp();
    await db.insert(scheduleEntry).values(harbourEntry(f));

    await db.delete(shift).where(eq(shift.id, f.frueh));

    const rows = await db
      .select({ shiftId: restaurantShift.shiftId })
      .from(restaurantShift);
    expect(rows).toEqual([{ shiftId: f.spaet }]);
  });

  it("blocks taking a restaurant off an employee who has shifts there", async () => {
    const f = await setUp();
    await db.insert(scheduleEntry).values(harbourEntry(f));

    const query = db
      .delete(employeeRestaurant)
      .where(
        and(
          eq(employeeRestaurant.employeeId, f.mohammad),
          eq(employeeRestaurant.restaurantId, f.harbour)
        )
      );
    expect(await pgErrorCode(query)).toBe(FOREIGN_KEY_VIOLATION);
  });

  it("removes a restaurant's shift times, schedules, entries and employee links with it", async () => {
    const f = await setUp();
    await db.insert(scheduleEntry).values(riversideEntry(f));
    await db.insert(scheduleEntry).values(harbourEntry(f));

    await db.delete(restaurant).where(eq(restaurant.id, f.riverside));

    const entries = await db
      .select({ restaurantId: scheduleEntry.restaurantId })
      .from(scheduleEntry);
    expect(entries).toEqual([{ restaurantId: f.harbour }]);
    const restaurantShifts = await db
      .select({ restaurantId: restaurantShift.restaurantId })
      .from(restaurantShift);
    expect(restaurantShifts).toEqual([
      { restaurantId: f.harbour },
      { restaurantId: f.harbour },
    ]);
    expect(await db.select().from(schedule)).toHaveLength(1);
    const links = await db
      .select({ employeeId: employeeRestaurant.employeeId })
      .from(employeeRestaurant);
    expect(links).toEqual([{ employeeId: f.mohammad }]);
    // The owner's shifts and the employees stay.
    expect(await db.select().from(shift)).toHaveLength(2);
    expect(await db.select().from(employee)).toHaveLength(2);
  });

  it("removes everything of an owner with the owner, even used shifts", async () => {
    const f = await setUp();
    await db.insert(scheduleEntry).values(riversideEntry(f));
    await db.insert(scheduleEntry).values(harbourEntry(f));
    const id = await insertAvailability(f);
    await insertDay(f, id);

    await db.delete(appUser).where(eq(appUser.id, f.ownerId));

    expect(await db.select().from(shift)).toHaveLength(0);
    expect(await db.select().from(restaurantShift)).toHaveLength(0);
    expect(await db.select().from(scheduleEntry)).toHaveLength(0);
    expect(await db.select().from(employee)).toHaveLength(0);
    expect(await db.select().from(availability)).toHaveLength(0);
    expect(await db.select().from(availabilityDay)).toHaveLength(0);
  });

  it("removes an employee's restaurants, entries and availability with the employee", async () => {
    const f = await setUp();
    await db.insert(scheduleEntry).values(riversideEntry(f));
    await db.insert(scheduleEntry).values(harbourEntry(f));
    await db
      .insert(scheduleEntry)
      .values(riversideEntry(f, { employeeId: f.anduena }));
    const id = await insertAvailability(f);
    await insertDay(f, id);

    await db.delete(employee).where(eq(employee.id, f.mohammad));

    const entries = await db
      .select({ employeeId: scheduleEntry.employeeId })
      .from(scheduleEntry);
    expect(entries).toEqual([{ employeeId: f.anduena }]);
    const links = await db
      .select({ employeeId: employeeRestaurant.employeeId })
      .from(employeeRestaurant);
    expect(links).toEqual([{ employeeId: f.anduena }]);
    expect(await db.select().from(availability)).toHaveLength(0);
    expect(await db.select().from(availabilityDay)).toHaveLength(0);
  });

  it("removes a week's days with the week", async () => {
    const f = await setUp();
    const id = await insertAvailability(f);
    await insertDay(f, id, { weekday: 1 });
    await insertDay(f, id, { weekday: 2 });

    await db.delete(availability).where(eq(availability.id, id));

    expect(await db.select().from(availabilityDay)).toHaveLength(0);
  });
});

describe("app_user", () => {
  it("allows an employee without any way to log in", async () => {
    const [user] = await db
      .insert(appUser)
      .values({ email: "employee@example.com", role: "employee" })
      .returning({ passwordHash: appUser.passwordHash });

    expect(user.passwordHash).toBeNull();
  });

  it("refuses an owner without a password or a Google id", async () => {
    expect(
      await pgErrorCode(
        db.insert(appUser).values({ email: "owner@example.com", role: "owner" })
      )
    ).toBe(CHECK_VIOLATION);
  });
});
