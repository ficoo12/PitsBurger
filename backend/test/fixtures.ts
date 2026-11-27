import { PALETTE_COLOURS } from "../src/lib/palette.js";

/**
 * Hands out the palette's colours in turn, for test positions and restaurants
 * that must not share one. Unique as long as one test creates at most 12 of
 * them per owner; the turn carries on across tests, which doesn't matter
 * because the database is wiped in between.
 */
export function colourPicker() {
  let next = 0;
  return () => PALETTE_COLOURS[next++ % PALETTE_COLOURS.length];
}
