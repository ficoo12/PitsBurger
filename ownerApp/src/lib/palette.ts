// The schedule colours. The backend stores a position's and a restaurant's hue
// and a shift's shade (enums palette_colour and shift_shade); the tokens in
// styles/variables.css hold the actual colours as --palette-<colour>-<shade>.

/** In the order the swatch grid shows them, and the next free one is picked. */
export const PALETTE = [
  "red",
  "orange",
  "yellow",
  "lime",
  "green",
  "teal",
  "sky",
  "blue",
  "indigo",
  "purple",
  "pink",
  "brown",
] as const;
export type PaletteColour = (typeof PALETTE)[number];

export const PALETTE_LABELS: Record<PaletteColour, string> = {
  red: "Red",
  orange: "Orange",
  yellow: "Yellow",
  lime: "Lime",
  green: "Green",
  teal: "Teal",
  sky: "Sky blue",
  blue: "Blue",
  indigo: "Indigo",
  purple: "Purple",
  pink: "Pink",
  brown: "Brown",
};

/** A shift's shade of the position's hue: light, mid and dark in the Excel plans. */
export const SHADES = ["early", "late", "full"] as const;
export type Shade = (typeof SHADES)[number];

export const SHADE_LABELS: Record<Shade, string> = {
  early: "Early",
  late: "Late",
  full: "Full day",
};

/** The first entry of `order` that isn't in `taken`, or null when every one is. */
export function nextFree<T extends string>(order: readonly T[], taken: readonly T[]): T | null {
  return order.find((value) => !taken.includes(value)) ?? null;
}

/** The CSS value of a colour in a shade, e.g. var(--palette-red-early). */
export function paletteVar(colour: PaletteColour, shade: Shade): string {
  return `var(--palette-${colour}-${shade})`;
}

/** The token's name, for code that reads the computed colour (the PDF). */
export function paletteToken(colour: PaletteColour, shade: Shade): string {
  return `--palette-${colour}-${shade}`;
}

/** A restaurant column's background: its hue from the Early to the Late shade. */
export function restaurantGradient(colour: PaletteColour): string {
  return `linear-gradient(180deg, ${paletteVar(colour, "early")}, ${paletteVar(colour, "late")})`;
}

/** A swatch for SwatchPicker (components/ui/SwatchPicker). */
type Swatch<T extends string> = {
  value: T;
  label: string;
  colours: string[];
  takenBy?: string;
};

/**
 * The twelve hues as swatches, each showing its three shades. A hue one of
 * `others` already has is marked with that record's name, so it can't be picked.
 */
export function hueSwatches(
  others: readonly { name: string; colour: PaletteColour }[],
): Swatch<PaletteColour>[] {
  return PALETTE.map((colour) => ({
    value: colour,
    label: PALETTE_LABELS[colour],
    colours: SHADES.map((shade) => paletteVar(colour, shade)),
    takenBy: others.find((other) => other.colour === colour)?.name,
  }));
}

/** The Excel plans' hues, to preview a shade in. */
const SAMPLE_HUES: PaletteColour[] = ["red", "yellow", "green"];

/** A shade shown in a few hues, for a swatch or a chip: a shade has no colour of its own. */
export function shadeSample(shade: Shade): string[] {
  return SAMPLE_HUES.map((colour) => paletteVar(colour, shade));
}

/**
 * The three shades as swatches, each showing the shade in a few hues. A shade
 * one of `others` already has is marked with that shift's name.
 */
export function shadeSwatches(others: readonly { name: string; shade: Shade }[]): Swatch<Shade>[] {
  return SHADES.map((shade) => ({
    value: shade,
    label: SHADE_LABELS[shade],
    colours: shadeSample(shade),
    takenBy: others.find((other) => other.shade === shade)?.name,
  }));
}
