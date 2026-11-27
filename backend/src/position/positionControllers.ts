import type { Request } from "express";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/dbcon.js";
import { position } from "../db/schema.js";
import type { AuthedResponse } from "../auth/authMiddleware.js";
import { isUniqueViolation } from "../auth/helpers/isUniqueViolation.js";
import { uniqueViolationConstraint } from "../lib/uniqueViolation.js";
import {
  createPositionSchema,
  positionIdSchema,
  updatePositionSchema,
} from "./positionSchema.js";

// What the API returns for a position. owner_id is left out: it is always the
// signed-in owner.
const publicPositionColumns = {
  id: position.id,
  name: position.name,
  colour: position.colour,
};

const NOT_FOUND = "Position not found";
const DUPLICATE_NAME = "A position with this name already exists";
const COLOUR_TAKEN = "Another position already has this colour";

/**
 * The 409 for a write that hit one of the two unique rules, or null for any
 * other error. A taken colour also names the field, so the form can show it
 * under the colour picker; a taken name stays a plain 409.
 */
function conflictOf(err: unknown) {
  if (uniqueViolationConstraint(err) === "position_owner_id_colour_idx") {
    return { error: COLOUR_TAKEN, fields: { colour: [COLOUR_TAKEN] } };
  }
  if (isUniqueViolation(err)) return { error: DUPLICATE_NAME };
  return null;
}

export async function createPosition(req: Request, res: AuthedResponse) {
  const parsed = createPositionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid input",
      fields: z.flattenError(parsed.error).fieldErrors,
    });
  }

  let created;
  try {
    [created] = await db
      .insert(position)
      .values({ ...parsed.data, ownerId: res.locals.user.id })
      .returning(publicPositionColumns);
  } catch (err) {
    // (owner_id, name) or (owner_id, colour). Caught instead of checked
    // first, so two requests at once can't both get the same colour.
    const conflict = conflictOf(err);
    if (conflict) return res.status(409).json(conflict);
    throw err;
  }

  return res.status(201).json({ position: created });
}

export async function listPositions(req: Request, res: AuthedResponse) {
  const positions = await db
    .select(publicPositionColumns)
    .from(position)
    .where(eq(position.ownerId, res.locals.user.id))
    .orderBy(asc(position.name), asc(position.id));

  return res.json({ positions });
}

export async function updatePosition(req: Request, res: AuthedResponse) {
  const params = positionIdSchema.safeParse(req.params);
  if (!params.success) {
    return res.status(404).json({ error: NOT_FOUND });
  }
  const parsed = updatePositionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid input",
      fields: z.flattenError(parsed.error).fieldErrors,
    });
  }

  let updated;
  try {
    // The owner filter makes someone else's position look like a missing one.
    [updated] = await db
      .update(position)
      .set(parsed.data)
      .where(
        and(
          eq(position.id, params.data.id),
          eq(position.ownerId, res.locals.user.id)
        )
      )
      .returning(publicPositionColumns);
  } catch (err) {
    // Another position's name or colour. Keeping its own is fine.
    const conflict = conflictOf(err);
    if (conflict) return res.status(409).json(conflict);
    throw err;
  }

  if (!updated) {
    return res.status(404).json({ error: NOT_FOUND });
  }
  return res.json({ position: updated });
}

export async function deletePosition(req: Request, res: AuthedResponse) {
  const params = positionIdSchema.safeParse(req.params);
  if (!params.success) {
    return res.status(404).json({ error: NOT_FOUND });
  }

  // The owner filter makes someone else's position look like a missing one.
  // Its employee_position rows go with it (ON DELETE CASCADE).
  const [deleted] = await db
    .delete(position)
    .where(
      and(
        eq(position.id, params.data.id),
        eq(position.ownerId, res.locals.user.id)
      )
    )
    .returning({ id: position.id });

  if (!deleted) {
    return res.status(404).json({ error: NOT_FOUND });
  }
  return res.status(204).end();
}
