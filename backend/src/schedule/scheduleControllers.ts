import type { Request } from "express";
import { z } from "zod";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../db/dbcon.js";
import {
  availability,
  availabilityDay,
  employee,
  employeeRestaurant,
  restaurant,
  schedule,
  scheduleEntry,
} from "../db/schema.js";
import type { AuthedResponse } from "../auth/authMiddleware.js";
import { isUniqueViolation } from "../auth/helpers/isUniqueViolation.js";
import {
  createEntrySchema,
  entryIdSchema,
  getScheduleSchema,
  updateEntrySchema,
} from "./scheduleSchema.js";
import { weekStartOf } from "./helpers/weekStartOf.js";
import { changedTimes } from "./helpers/changedTimes.js";
import { entryColumns, formatEntry } from "./helpers/entryColumns.js";
import { findRestaurantShift } from "./helpers/findRestaurantShift.js";
import { addDays } from "../availability/helpers/berlinClock.js";

const ENTRY_NOT_FOUND = "Schedule entry not found";
const SAME_DAY = "This employee already has a shift on this day";
const SAME_TIME = "The shift can't start and end at the same time";

/** The ids of the owner's restaurants, as a subquery. */
function ownRestaurantIds(ownerId: number) {
  return db
    .select({ id: restaurant.id })
    .from(restaurant)
    .where(eq(restaurant.ownerId, ownerId));
}

export async function getSchedule(req: Request, res: AuthedResponse) {
  const parsed = getScheduleSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid input",
      fields: z.flattenError(parsed.error).fieldErrors,
    });
  }
  const { restaurantId, weekStart } = parsed.data;
  const ownerId = res.locals.user.id;

  // The owner filter makes someone else's restaurant look like a missing one.
  const [ownRestaurant] = await db
    .select({ id: restaurant.id })
    .from(restaurant)
    .where(and(eq(restaurant.id, restaurantId), eq(restaurant.ownerId, ownerId)));
  if (!ownRestaurant) {
    return res.status(404).json({ error: "Restaurant not found" });
  }

  // Read-only and independent of each other, so they run side by side.
  const [entries, availabilities] = await Promise.all([
    // A week whose schedule doesn't exist yet simply has no cells.
    db
      .select(entryColumns)
      .from(scheduleEntry)
      .innerJoin(schedule, eq(scheduleEntry.scheduleId, schedule.id))
      .where(
        and(
          eq(schedule.restaurantId, restaurantId),
          eq(schedule.weekStart, weekStart)
        )
      )
      .orderBy(asc(scheduleEntry.workDate), asc(scheduleEntry.id)),
    // Availability is shown only in the person's default restaurant, and only
    // for people still working here: someone who has left gets no new shifts.
    db
      .select({
        id: availability.id,
        employeeId: availability.employeeId,
        note: availability.note,
      })
      .from(availability)
      .innerJoin(employee, eq(employee.id, availability.employeeId))
      .innerJoin(
        employeeRestaurant,
        and(
          eq(employeeRestaurant.employeeId, employee.id),
          eq(employeeRestaurant.isDefault, true),
          eq(employeeRestaurant.restaurantId, restaurantId)
        )
      )
      .where(
        and(
          eq(availability.weekStart, weekStart),
          eq(employee.status, "active")
        )
      )
      .orderBy(asc(availability.employeeId)),
  ]);

  // Every day the owner hasn't dismissed, also days that already have a cell
  // here: the app hides those, so clearing the cell brings the hint back.
  const days =
    availabilities.length > 0
      ? await db
          .select({
            availabilityId: availabilityDay.availabilityId,
            weekday: availabilityDay.weekday,
            shiftId: availabilityDay.shiftId,
          })
          .from(availabilityDay)
          .where(
            and(
              inArray(
                availabilityDay.availabilityId,
                availabilities.map((week) => week.id)
              ),
              isNull(availabilityDay.dismissedAt)
            )
          )
          .orderBy(asc(availabilityDay.weekday))
      : [];

  return res.json({
    schedule: {
      restaurantId,
      weekStart,
      entries: entries.map(formatEntry),
      // People with a note but no days are included: the note is still read.
      availability: availabilities.map((week) => ({
        employeeId: week.employeeId,
        note: week.note,
        days: days
          .filter((day) => day.availabilityId === week.id)
          .map((day) => ({
            date: addDays(weekStart, day.weekday - 1),
            shiftId: day.shiftId,
          })),
      })),
    },
  });
}

export async function createEntry(req: Request, res: AuthedResponse) {
  const parsed = createEntrySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid input",
      fields: z.flattenError(parsed.error).fieldErrors,
    });
  }
  const {
    employeeId,
    restaurantId,
    workDate,
    shiftId,
    startTime = null,
    endTime = null,
    note = null,
  } = parsed.data;
  const ownerId = res.locals.user.id;

  let result;
  try {
    result = await db.transaction(async (tx) => {
      // FOR SHARE until the cell is written: the employee can't be taken off
      // the restaurant or deleted (and findRestaurantShift keeps the shift
      // from being deleted).
      // The owner filter makes someone else's employee look like a missing one.
      const [emp] = await tx
        .select({ status: employee.status })
        .from(employee)
        .where(and(eq(employee.id, employeeId), eq(employee.ownerId, ownerId)))
        .for("share");
      if (!emp) return { fields: { employeeId: ["Employee not found"] } };
      if (emp.status === "left") {
        return { fields: { employeeId: ["This employee has left"] } };
      }

      // Also covers someone else's restaurant: nobody of this owner works
      // there.
      const [worksThere] = await tx
        .select({ restaurantId: employeeRestaurant.restaurantId })
        .from(employeeRestaurant)
        .where(
          and(
            eq(employeeRestaurant.employeeId, employeeId),
            eq(employeeRestaurant.restaurantId, restaurantId)
          )
        );
      if (!worksThere) {
        return {
          fields: {
            restaurantId: ["This employee doesn't work in this restaurant"],
          },
        };
      }

      const shift = await findRestaurantShift(tx, restaurantId, shiftId);
      if (!shift) return { fields: { shiftId: ["Shift not found"] } };

      const times = changedTimes(shift, startTime, endTime);
      if (!times) return { fields: { endTime: [SAME_TIME] } };

      // One shift per person per day, in all of the owner's restaurants. The
      // unique (employee_id, work_date) constraint enforces it; this check only
      // finds the restaurant to name in the message.
      const [taken] = await tx
        .select({
          restaurantId: scheduleEntry.restaurantId,
          restaurantName: restaurant.name,
        })
        .from(scheduleEntry)
        .innerJoin(restaurant, eq(scheduleEntry.restaurantId, restaurant.id))
        .where(
          and(
            eq(scheduleEntry.employeeId, employeeId),
            eq(scheduleEntry.workDate, workDate)
          )
        );
      if (taken) {
        return {
          conflict:
            taken.restaurantId === restaurantId
              ? SAME_DAY
              : `This employee already works at ${taken.restaurantName} on this day`,
        };
      }

      // The week's schedule is created with its first cell.
      const weekStart = weekStartOf(workDate);
      await tx
        .insert(schedule)
        .values({ restaurantId, weekStart })
        .onConflictDoNothing();
      const [week] = await tx
        .select({ id: schedule.id })
        .from(schedule)
        .where(
          and(
            eq(schedule.restaurantId, restaurantId),
            eq(schedule.weekStart, weekStart)
          )
        );

      const [entry] = await tx
        .insert(scheduleEntry)
        .values({
          scheduleId: week.id,
          employeeId,
          shiftId,
          workDate,
          ...times,
          note,
          restaurantId,
          weekStart,
        })
        .returning(entryColumns);
      return { entry };
    });
  } catch (err) {
    // Two saves for the same person and day at the same moment.
    if (isUniqueViolation(err)) {
      return res.status(409).json({ error: SAME_DAY });
    }
    throw err;
  }

  if ("fields" in result) {
    return res
      .status(400)
      .json({ error: "Invalid input", fields: result.fields });
  }
  if ("conflict" in result) {
    return res.status(409).json({ error: result.conflict });
  }
  return res.status(201).json({ entry: formatEntry(result.entry) });
}

export async function updateEntry(req: Request, res: AuthedResponse) {
  const params = entryIdSchema.safeParse(req.params);
  if (!params.success) {
    return res.status(404).json({ error: ENTRY_NOT_FOUND });
  }
  const parsed = updateEntrySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid input",
      fields: z.flattenError(parsed.error).fieldErrors,
    });
  }
  const { id } = params.data;
  const { shiftId, startTime, endTime, note } = parsed.data;
  const ownerId = res.locals.user.id;

  // Cells of an employee who has left can still be changed.
  const result = await db.transaction(async (tx) => {
    // The owner filter makes someone else's cell look like a missing one.
    const [cell] = await tx
      .select({ restaurantId: scheduleEntry.restaurantId })
      .from(scheduleEntry)
      .where(
        and(
          eq(scheduleEntry.id, id),
          inArray(scheduleEntry.restaurantId, ownRestaurantIds(ownerId))
        )
      )
      .for("update");
    if (!cell) return "not_found" as const;

    const shift = await findRestaurantShift(tx, cell.restaurantId, shiftId);
    if (!shift) return { fields: { shiftId: ["Shift not found"] } };

    const times = changedTimes(shift, startTime, endTime);
    if (!times) return { fields: { endTime: [SAME_TIME] } };

    const [entry] = await tx
      .update(scheduleEntry)
      .set({ shiftId, ...times, note })
      .where(eq(scheduleEntry.id, id))
      .returning(entryColumns);
    return { entry };
  });

  if (result === "not_found") {
    return res.status(404).json({ error: ENTRY_NOT_FOUND });
  }
  if ("fields" in result) {
    return res
      .status(400)
      .json({ error: "Invalid input", fields: result.fields });
  }
  return res.json({ entry: formatEntry(result.entry) });
}

export async function deleteEntry(req: Request, res: AuthedResponse) {
  const params = entryIdSchema.safeParse(req.params);
  if (!params.success) {
    return res.status(404).json({ error: ENTRY_NOT_FOUND });
  }

  // The owner filter makes someone else's cell look like a missing one. A week
  // whose last cell is cleared keeps its schedule row; without cells it looks
  // the same as a week that never had one.
  const [deleted] = await db
    .delete(scheduleEntry)
    .where(
      and(
        eq(scheduleEntry.id, params.data.id),
        inArray(scheduleEntry.restaurantId, ownRestaurantIds(res.locals.user.id))
      )
    )
    .returning({ id: scheduleEntry.id });

  if (!deleted) {
    return res.status(404).json({ error: ENTRY_NOT_FOUND });
  }
  return res.status(204).end();
}
