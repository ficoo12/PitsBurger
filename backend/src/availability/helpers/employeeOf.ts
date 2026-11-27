import { and, eq } from "drizzle-orm";
import { db } from "../../db/dbcon.js";
import { employee, employeeRestaurant, restaurant } from "../../db/schema.js";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * The signed-in employee's row with their default restaurant: their
 * availability belongs to that restaurant's schedule. Returns a query, so a
 * caller can add a row lock. No row = no employee row or no default
 * restaurant, which logins and the employee API rule out.
 */
export function employeeOf(executor: typeof db | Tx, userId: number) {
  return executor
    .select({
      id: employee.id,
      ownerId: employee.ownerId,
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
    })
    .from(employee)
    .innerJoin(
      employeeRestaurant,
      and(
        eq(employeeRestaurant.employeeId, employee.id),
        eq(employeeRestaurant.isDefault, true)
      )
    )
    .innerJoin(restaurant, eq(restaurant.id, employeeRestaurant.restaurantId))
    .where(eq(employee.userId, userId));
}
