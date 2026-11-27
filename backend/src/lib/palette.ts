import { paletteColour, shiftShade } from "../db/schema.js";

// The schedule colours the API accepts, straight from the database enums so
// the two can't drift apart. The frontend has the matching tokens.

/** A position's or a restaurant's hue. */
export const PALETTE_COLOURS = paletteColour.enumValues;

/** A shift's shade of the position's hue: Early, Late or Full day. */
export const SHIFT_SHADES = shiftShade.enumValues;
