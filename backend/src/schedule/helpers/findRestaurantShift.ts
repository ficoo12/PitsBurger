import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db/dbcon.js";
import { restaurantShift, shift } from "../../db/schema.js";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * A shift as one restaurant uses it: the restaurant's own times, or the
 * shift's default times. Undefined when the restaurant doesn't have that
 * shift (another owner's, or a deleted one). The restaurant's row stays
 * locked FOR SHARE until the cell is written, so the shift can't be deleted
 * in between.
 */
export async function findRestaurantShift(
  tx: Tx,
  restaurantId: number,
  shiftId: number
) {
  const [found] = await tx
    .select({
      startTime: sql<string>`COALESCE(${restaurantShift.startTime}, ${shift.startTime})`,
      endTime: sql<string>`COALESCE(${restaurantShift.endTime}, ${shift.endTime})`,
    })
    .from(restaurantShift)
    .innerJoin(shift, eq(restaurantShift.shiftId, shift.id))
    .where(
      and(
        eq(restaurantShift.restaurantId, restaurantId),
        eq(restaurantShift.shiftId, shiftId)
      )
    )
    .for("share", { of: restaurantShift });
  return found;
}
