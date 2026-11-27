import type { PaletteColour } from "../../../lib/palette";
import { fullName, type Employee } from "../../employees";
import type { Position } from "../../positions";
import type { Restaurant } from "../../restaurants";
import { cellShade, scheduleZones, shiftLabel, type CellShade } from "../scheduleRows";
import type { ScheduleEntry } from "../types";
import { addDays, isoWeekNumber, weekDays } from "../week";

/** One day of one person, as the PDF draws it. */
export type PdfCell = {
  /** What the screen's cell says ("Spät ab 18:00 | 336"), "" without a shift. */
  text: string;
  /** The colour of the row's zone; with the shade it picks the cell's colour. */
  colour: PaletteColour | null;
  shade: CellShade;
};

/** One person's line: their name and the week's seven days. */
export type PdfRow = { name: string; cells: PdfCell[] };

/** One restaurant's week: one page of the PDF. */
export type PdfPage = {
  restaurantName: string;
  /** The restaurant's colour, behind its name. */
  colour: PaletteColour;
  days: { name: string; label: string; closed: boolean }[];
  /**
   * The people on the week, in the screen's order (zone by zone, in the
   * order the positions were created, then the rest). The PDF doesn't name the
   * positions: the colours show them.
   */
  rows: PdfRow[];
};

/** What the PDF needs of one restaurant: its employees and the week's entries. */
export type RestaurantWeek = {
  restaurant: Restaurant;
  employees: Employee[];
  entries: ScheduleEntry[];
};

/**
 * The pages of the week's PDF, one per restaurant, in the order given. A
 * restaurant without a shift this week gets no page, so the list is empty
 * when nothing is planned. Only people with a saved shift get a row.
 */
export function schedulePdfPages(
  weeks: RestaurantWeek[],
  positions: Position[],
  weekStart: string,
): PdfPage[] {
  const days = weekDays(weekStart);
  return weeks
    .filter((week) => week.entries.length > 0)
    .map(({ restaurant, employees, entries }) => {
      const shifts = new Map(restaurant.shiftTimes.map((shift) => [shift.shiftId, shift]));
      const open = new Set(restaurant.openingHours.map((hours) => hours.weekday));
      return {
        restaurantName: restaurant.name,
        colour: restaurant.colour,
        days: days.map((day) => ({
          name: day.name,
          label: day.label,
          closed: !open.has(day.weekday),
        })),
        // No added rows: only a saved shift puts someone in the PDF.
        rows: scheduleZones(positions, employees, entries, []).flatMap((zone) =>
          zone.rows.map((row) => ({
            name: fullName(row.employee),
            cells: days.map((day) => {
              const entry = row.cells.get(day.date);
              const shift = entry && shifts.get(entry.shiftId);
              return {
                text: entry ? shiftLabel(entry, shift) : "",
                colour: entry ? (row.position?.colour ?? null) : null,
                shade: cellShade(entry, shift, !open.has(day.weekday)),
              };
            }),
          })),
        ),
      };
    });
}

/** "schedule-2026-W47.pdf": the ISO week and the year that week belongs to. */
export function pdfFilename(weekStart: string): string {
  // A week belongs to the year of its Thursday.
  const year = addDays(weekStart, 3).slice(0, 4);
  const week = String(isoWeekNumber(weekStart)).padStart(2, "0");
  return `schedule-${year}-W${week}.pdf`;
}
