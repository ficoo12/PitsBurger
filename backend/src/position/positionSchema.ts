import { z } from "zod";
import { PALETTE_COLOURS } from "../lib/palette.js";

const name = z.string().trim().min(1).max(100);

// The hue of the position's zone and cells in the schedule. Required: the
// owner app preselects the next free one.
const colour = z.enum(PALETTE_COLOURS);

// z.object strips unknown keys, so an `ownerId` sent by the client is dropped.
export const createPositionSchema = z.object({ name, colour });

// PUT replaces the whole position: its name and its colour.
export const updatePositionSchema = z.object({ name, colour });

// Plain digits only, so every position has exactly one URL: "1e2", "0x1F",
// " 12" and "012" are not ids. 15 digits always fit a JS number exactly.
export const positionIdSchema = z.object({
  id: z
    .string()
    .regex(/^[1-9]\d{0,14}$/)
    .transform(Number),
});

export type CreatePositionInput = z.infer<typeof createPositionSchema>;
export type UpdatePositionInput = z.infer<typeof updatePositionSchema>;
