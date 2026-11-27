import type { PaletteColour } from "../../../../lib/palette";
import type { CreatePositionInput, Position } from "../../types";

export type Values = {
  name: string;
  /** null while no colour is picked: every colour is taken. */
  colour: PaletteColour | null;
};

export type Errors = {
  name?: string;
  colour?: string;
};

/** A new position's values: no name yet, and the next free colour (or none). */
export function emptyValues(colour: PaletteColour | null): Values {
  return { name: "", colour };
}

/** The form's values for an existing position. */
export function fromPosition(position: Position): Values {
  return { name: position.name, colour: position.colour };
}

export const NAME_MAX_LENGTH = 100;

export function validate(values: Values): Errors {
  const errors: Errors = {};

  const name = values.name.trim();
  if (name === "") errors.name = "Enter the position's name.";
  else if (name.length > NAME_MAX_LENGTH) {
    errors.name = `Use at most ${NAME_MAX_LENGTH} characters.`;
  }

  if (values.colour === null) errors.colour = "Pick a colour.";

  return errors;
}

/** What is sent for valid values (validate() found no errors, so a colour is picked). */
export function toInput(values: Values): CreatePositionInput {
  return { name: values.name.trim(), colour: values.colour! };
}
