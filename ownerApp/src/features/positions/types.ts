import type { PaletteColour } from "../../lib/palette";

/**
 * A position as the API returns it (backend: publicPositionColumns). Positions
 * belong to the owner and are shared by all their restaurants.
 */
export type Position = {
  id: number;
  name: string;
  /** The hue of its zone and cells in the schedule; no other position of the owner has it. */
  colour: PaletteColour;
};

/**
 * Body of POST /positions. A colour another position already has answers
 * 409 with `fields.colour`; a taken name answers a plain 409.
 */
export type CreatePositionInput = {
  name: string;
  colour: PaletteColour;
};

/** Body of PUT /positions/:id. Replaces the whole position: its name and colour. */
export type EditPositionInput = CreatePositionInput;
