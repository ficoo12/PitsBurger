import { useCallback } from "react";
import { useSearchParams } from "react-router";
import { isWeekStart, thisWeekStart } from "../week";

/** The URL parameter that holds the shown week's Monday: ?week=2026-11-16 */
export const WEEK_PARAM = "week";

/**
 * The week the schedule shows, kept in the URL so it survives a reload. With
 * no parameter, or one that isn't a Monday, it is this week.
 */
export function useWeekParam(): [weekStart: string, setWeek: (weekStart: string) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const param = searchParams.get(WEEK_PARAM);
  const weekStart = param !== null && isWeekStart(param) ? param : thisWeekStart();

  const setWeek = useCallback(
    (week: string) => setSearchParams({ [WEEK_PARAM]: week }, { replace: true }),
    [setSearchParams],
  );
  return [weekStart, setWeek];
}
