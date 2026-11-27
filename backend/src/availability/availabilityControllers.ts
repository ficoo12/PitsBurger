import type { Request } from "express";
import { z } from "zod";
import { and, asc, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "../db/dbcon.js";
import {
  availability,
  availabilityDay,
  availabilitySettings,
  employee,
  restaurantOpeningHours,
  shift,
} from "../db/schema.js";
import type { AuthedResponse } from "../auth/authMiddleware.js";
import {
  dismissAvailabilitySchema,
  submitAvailabilitySchema,
  updateAvailabilitySettingsSchema,
} from "./availabilitySchema.js";
import {
  findAvailabilitySettings,
  formatSettings,
  publicSettingsColumns,
} from "./helpers/availabilitySettings.js";
import {
  addDays,
  berlinNow,
  isWindowOpen,
  nextOpening,
  nextWeekStart,
  shownWeekStart,
} from "./helpers/berlinClock.js";
import { employeeOf } from "./helpers/employeeOf.js";
import { shiftOrder } from "../shift/helpers/shiftOrder.js";
import { weekStartOf } from "../schedule/helpers/weekStartOf.js";

const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export async function getSettings(_req: Request, res: AuthedResponse) {
  const settings = await findAvailabilitySettings(res.locals.user.id);
  return res.json({ settings });
}

export async function updateSettings(req: Request, res: AuthedResponse) {
  const parsed = updateAvailabilitySettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid input",
      fields: z.flattenError(parsed.error).fieldErrors,
    });
  }
  const ownerId = res.locals.user.id;

  // The row is created on the first save. One upsert statement, so two
  // parallel first saves can't both try to insert.
  // Nothing else changes: employees who already saved more often than a
  // lowered max_saves simply can't save again this week.
  const [saved] = await db
    .insert(availabilitySettings)
    .values({ ...parsed.data, ownerId })
    .onConflictDoUpdate({
      target: availabilitySettings.ownerId,
      set: parsed.data,
    })
    .returning(publicSettingsColumns);

  return res.json({ settings: formatSettings(saved) });
}

/** A failed check about the picked days, shown under them in the app. */
function invalidDays(message: string) {
  return {
    status: 400,
    body: { error: "Invalid input", fields: { days: [message] } },
  };
}

/**
 * An employee saves their availability for next week: the days they can work,
 * with a shift each, and a note. Every save replaces the week and counts
 * against the owner's max saves, even when nothing changed.
 */
export async function submitAvailability(req: Request, res: AuthedResponse) {
  const parsed = submitAvailabilitySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid input",
      fields: z.flattenError(parsed.error).fieldErrors,
    });
  }
  const days = [...parsed.data.days].sort((a, b) => a.weekday - b.weekday);
  const { note } = parsed.data;
  const now = berlinNow();
  const weekStart = nextWeekStart(now.date);

  const result = await db.transaction(async (tx) => {
    // Locks this employee's row until the save is done: two saves at the same
    // moment would otherwise both see a save left, or both insert the week.
    // NO KEY UPDATE doesn't block foreign key checks on the row.
    const [me] = await employeeOf(tx, res.locals.user.id).for("no key update", {
      of: employee,
    });
    // Can't happen while logins follow the access rule (an active employee on
    // a contract that submits availability always has a default restaurant).
    if (!me) {
      return {
        status: 403,
        body: { error: "You can't submit availability" },
      };
    }

    const settings = await findAvailabilitySettings(me.ownerId, tx);
    if (!isWindowOpen(settings, now)) {
      const { maxSaves: _maxSaves, ...window } = settings;
      return {
        status: 409,
        body: { error: "The availability window is closed", window },
      };
    }

    // Only days the default restaurant is open can be picked: its schedule
    // is where the availability is shown.
    if (days.length > 0) {
      const openDays = await tx
        .select({ weekday: restaurantOpeningHours.weekday })
        .from(restaurantOpeningHours)
        .where(eq(restaurantOpeningHours.restaurantId, me.restaurantId));
      const open = new Set(openDays.map((day) => day.weekday));
      const closed = days.find((day) => !open.has(day.weekday));
      if (closed) {
        return invalidDays(
          `Your restaurant is closed on ${WEEKDAY_NAMES[closed.weekday - 1]}`
        );
      }

      // The owner filter makes another owner's shift look like a missing one.
      const shiftIds = [...new Set(days.map((day) => day.shiftId))];
      const known = await tx
        .select({ id: shift.id })
        .from(shift)
        .where(and(eq(shift.ownerId, me.ownerId), inArray(shift.id, shiftIds)));
      if (known.length !== shiftIds.length) {
        return invalidDays("Pick one of the listed shifts");
      }
    }

    const [week] = await tx
      .select({ id: availability.id, saveCount: availability.saveCount })
      .from(availability)
      .where(
        and(
          eq(availability.employeeId, me.id),
          eq(availability.weekStart, weekStart)
        )
      );
    // >= rather than ===: the owner may have lowered the limit since.
    if (week && week.saveCount >= settings.maxSaves) {
      return {
        status: 409,
        body: { error: "You have no saves left this week" },
      };
    }

    // Everything that can fail has been checked; the writes start here.
    let availabilityId: number;
    let saveCount: number;
    // A day the owner dismissed stays dismissed while its shift is unchanged;
    // a changed or new day is a new hint in the schedule.
    const dismissed = new Map<string, Date>();
    if (week) {
      const oldDays = await tx
        .select({
          weekday: availabilityDay.weekday,
          shiftId: availabilityDay.shiftId,
          dismissedAt: availabilityDay.dismissedAt,
        })
        .from(availabilityDay)
        .where(eq(availabilityDay.availabilityId, week.id));
      for (const day of oldDays) {
        if (day.dismissedAt) {
          dismissed.set(`${day.weekday}:${day.shiftId}`, day.dismissedAt);
        }
      }
      await tx
        .delete(availabilityDay)
        .where(eq(availabilityDay.availabilityId, week.id));

      const [updated] = await tx
        .update(availability)
        .set({ note, saveCount: sql`${availability.saveCount} + 1` })
        .where(eq(availability.id, week.id))
        .returning({ saveCount: availability.saveCount });
      availabilityId = week.id;
      saveCount = updated.saveCount;
    } else {
      const [created] = await tx
        .insert(availability)
        .values({ employeeId: me.id, ownerId: me.ownerId, weekStart, note })
        .returning({ id: availability.id, saveCount: availability.saveCount });
      availabilityId = created.id;
      saveCount = created.saveCount;
    }

    if (days.length > 0) {
      await tx.insert(availabilityDay).values(
        days.map((day) => ({
          availabilityId,
          weekday: day.weekday,
          shiftId: day.shiftId,
          ownerId: me.ownerId,
          dismissedAt: dismissed.get(`${day.weekday}:${day.shiftId}`) ?? null,
        }))
      );
    }

    // Weeks that ended more than two weeks ago are no longer needed, for any
    // owner. A week ends on week_start + 6, so that is week_start + 6 earlier
    // than today − 14.
    await tx
      .delete(availability)
      .where(lt(availability.weekStart, addDays(now.date, -20)));

    return {
      status: week ? 200 : 201,
      body: {
        availability: {
          weekStart,
          note,
          days,
          savesLeft: Math.max(settings.maxSaves - saveCount, 0),
        },
      },
    };
  });

  return res.status(result.status).json(result.body);
}

/**
 * Everything the employee app's availability screen needs, in one response:
 * the week it shows (see shownWeekStart), whether they can save now, the
 * default restaurant's open days, the owner's shift names and what they saved
 * for that week.
 */
export async function getAvailability(_req: Request, res: AuthedResponse) {
  const [me] = await employeeOf(db, res.locals.user.id);
  if (!me) {
    return res.status(403).json({ error: "You can't submit availability" });
  }

  const now = berlinNow();
  const { maxSaves, ...window } = await findAvailabilitySettings(me.ownerId);
  const weekStart = shownWeekStart(window, now);

  // Read-only and independent of each other, so they run side by side.
  const [openDays, shifts, [week]] = await Promise.all([
    db
      .select({ weekday: restaurantOpeningHours.weekday })
      .from(restaurantOpeningHours)
      .where(eq(restaurantOpeningHours.restaurantId, me.restaurantId))
      .orderBy(asc(restaurantOpeningHours.weekday)),
    // Names only: the employee picks a shift, not its times.
    db
      .select({ id: shift.id, name: shift.name })
      .from(shift)
      .where(eq(shift.ownerId, me.ownerId))
      .orderBy(...shiftOrder),
    db
      .select({
        id: availability.id,
        note: availability.note,
        saveCount: availability.saveCount,
      })
      .from(availability)
      .where(
        and(
          eq(availability.employeeId, me.id),
          eq(availability.weekStart, weekStart)
        )
      ),
  ]);
  // Exactly as saved, even a day the restaurant has closed since: the app
  // only shows open days, and the next save can't include a closed one.
  const savedDays = week
    ? await db
        .select({
          weekday: availabilityDay.weekday,
          shiftId: availabilityDay.shiftId,
        })
        .from(availabilityDay)
        .where(eq(availabilityDay.availabilityId, week.id))
        .orderBy(asc(availabilityDay.weekday))
    : [];

  return res.json({
    availability: {
      weekStart,
      isOpen: isWindowOpen(window, now),
      window,
      nextOpening: nextOpening(window, now),
      maxSaves,
      // Never negative: the owner may have lowered the limit since.
      savesLeft: Math.max(maxSaves - (week?.saveCount ?? 0), 0),
      restaurant: { id: me.restaurantId, name: me.restaurantName },
      days: openDays.map(({ weekday }) => ({
        weekday,
        date: addDays(weekStart, weekday - 1),
      })),
      shifts,
      submission: week ? { note: week.note, days: savedDays } : null,
    },
  });
}

/**
 * The owner dismisses one day of someone's availability: its hint leaves the
 * schedule without a shift being saved. The submission itself stays as the
 * employee sent it. Dismissing a day twice keeps the first time.
 */
export async function dismissAvailability(req: Request, res: AuthedResponse) {
  const parsed = dismissAvailabilitySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid input",
      fields: z.flattenError(parsed.error).fieldErrors,
    });
  }
  const { employeeId, date } = parsed.data;
  const weekStart = weekStartOf(date);
  // getUTCDay counts from Sunday (0); ISO weekdays count from Monday (1).
  const weekday = ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;

  // The owner filter makes someone else's availability look like a missing one.
  const [dismissed] = await db
    .update(availabilityDay)
    .set({ dismissedAt: sql`coalesce(${availabilityDay.dismissedAt}, now())` })
    .where(
      and(
        eq(availabilityDay.ownerId, res.locals.user.id),
        eq(availabilityDay.weekday, weekday),
        inArray(
          availabilityDay.availabilityId,
          db
            .select({ id: availability.id })
            .from(availability)
            .where(
              and(
                eq(availability.employeeId, employeeId),
                eq(availability.weekStart, weekStart)
              )
            )
        )
      )
    )
    .returning({ weekday: availabilityDay.weekday });

  if (!dismissed) {
    return res.status(404).json({ error: "Availability not found" });
  }
  return res.status(204).end();
}
