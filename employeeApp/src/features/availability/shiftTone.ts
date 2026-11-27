/**
 * How a shift value is filled, read by shiftTone.module.css:
 * - "plain": a picked shift (white with a dark ring)
 * - "none": not available (black)
 * - "closed": the restaurant is closed that day (grey)
 *
 * The owner's plans colour a shift by the position's colour and the shift's
 * shade, which the backend now stores. This app doesn't get them from the API
 * yet, so every picked shift is plain; plan colours here are a later step.
 */
export type ShiftTone = "plain" | "none" | "closed";
