import { useMutation, useQueryClient } from "@tanstack/react-query";
import { employeesQuery } from "../../employees";
import { positionsQuery } from "../../positions";
import type { Restaurant } from "../../restaurants";
import { pdfFilename, schedulePdfPages } from "../export/schedulePdfModel";
import { shareOrDownload } from "../export/shareOrDownload";
import { scheduleQuery } from "./useGetSchedule";

/** No restaurant has a shift in the week, so there is nothing to put in a PDF. */
export class NothingPlannedError extends Error {
  constructor() {
    super("Nothing planned this week");
    this.name = "NothingPlannedError";
  }
}

type ExportInput = {
  restaurants: Restaurant[];
  /** The week's Monday, "YYYY-MM-DD". */
  weekStart: string;
};

/**
 * Exports one week of all the given restaurants as one PDF and shares or
 * downloads it. The employees and schedules come through the query cache, so
 * what the page has already loaded isn't asked for again, and a table that is
 * still loading is waited for.
 *
 * Fails with NothingPlannedError when no restaurant has a shift that week.
 */
export function useExportSchedules() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ restaurants, weekStart }: ExportInput) => {
      const [positions, ...weeks] = await Promise.all([
        queryClient.fetchQuery(positionsQuery),
        ...restaurants.map(async (restaurant) => {
          const [employees, schedule] = await Promise.all([
            queryClient.fetchQuery(employeesQuery(restaurant.id)),
            queryClient.fetchQuery(scheduleQuery(restaurant.id, weekStart)),
          ]);
          return { restaurant, employees, entries: schedule.entries };
        }),
      ]);
      const pages = schedulePdfPages(weeks, positions, weekStart);
      if (pages.length === 0) throw new NothingPlannedError();

      // On demand: jsPDF and the fonts are only downloaded for an export.
      const { renderSchedulePdf } = await import("../export/renderSchedulePdf");
      const blob = await renderSchedulePdf(pages, weekStart);
      await shareOrDownload(blob, pdfFilename(weekStart));
    },
  });
}
