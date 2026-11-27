import { useState } from "react";
import { Alert } from "../../../../components/ui/Alert/Alert";
import { Button } from "../../../../components/ui/Button/Button";
import { Spinner } from "../../../../components/ui/Spinner/Spinner";
import { toApiError } from "../../../../lib/apiClient";
import { useGetPositions } from "../../../positions";
import { useGetRestaurants } from "../../../restaurants";
import { NothingPlannedError, useExportSchedules } from "../../api/useExportSchedules";
import { usePrefetchWeek } from "../../hooks/usePrefetchWeek";
import { useWeekParam } from "../../hooks/useWeekParam";
import { addWeeks } from "../../week";
import { AddEmployeePanel } from "../AddEmployeePanel/AddEmployeePanel";
import { RestaurantSchedule } from "../RestaurantSchedule/RestaurantSchedule";
import { WeekBar } from "../WeekBar/WeekBar";
import styles from "./ScheduleList.module.css";

/** The zone (position) whose "+ Add employee" panel is open. One at a time, across all restaurants. */
type OpenPanel = { restaurantId: number; positionId: number };

/**
 * The schedules of all the owner's restaurants for one week, one under
 * another. The week bar above them moves every restaurant to the previous or
 * next week together; the next week is loaded in the background, so its arrow
 * shows it at once. The week is kept in the URL (?week=2026-11-16).
 *
 * "Export PDF" in the week bar puts the shown week of every restaurant in one
 * PDF, to share or download.
 *
 * A zone's "+ Add employee" opens a side panel to put people on the week. It
 * stays open when the week changes and then adds to the new week.
 */
export function ScheduleList() {
  const restaurants = useGetRestaurants();
  // Every restaurant has a zone per position, in the position's colour.
  const positions = useGetPositions();
  const [weekStart, setWeek] = useWeekParam();
  const [panel, setPanel] = useState<OpenPanel | null>(null);
  const exportPdf = useExportSchedules();
  usePrefetchWeek(restaurants.data, addWeeks(weekStart, 1));

  // Only without a list: one that is already loaded stays on screen when a
  // refresh in the background fails (isError is true then, too).
  if (restaurants.data === undefined) {
    if (restaurants.isPending) return <Spinner label="Loading restaurants" />;
    return (
      <Alert title="Couldn't load restaurants" detail={toApiError(restaurants.error).message} />
    );
  }
  if (positions.data === undefined) {
    if (positions.isPending) return <Spinner label="Loading positions" />;
    return <Alert title="Couldn't load positions" detail={toApiError(positions.error).message} />;
  }
  if (restaurants.data.length === 0) {
    return (
      <Alert
        tone="neutral"
        title="No restaurants yet"
        detail="A schedule belongs to a restaurant. Add a restaurant first."
      />
    );
  }

  const panelRestaurant = panel && restaurants.data.find((item) => item.id === panel.restaurantId);
  // Gone when the position was deleted meanwhile: the panel closes then.
  const panelPosition = panel && positions.data.find((item) => item.id === panel.positionId);

  return (
    <>
      <WeekBar
        weekStart={weekStart}
        onChange={(week) => {
          // A message about the export belongs to the week it was for.
          exportPdf.reset();
          setWeek(week);
        }}
        actions={
          <Button
            variant="secondary"
            disabled={exportPdf.isPending}
            onClick={() => exportPdf.mutate({ restaurants: restaurants.data, weekStart })}
          >
            {exportPdf.isPending ? "Exporting…" : "Export PDF"}
          </Button>
        }
      />
      {exportPdf.isError &&
        (exportPdf.error instanceof NothingPlannedError ? (
          <Alert
            tone="neutral"
            title="Nothing planned this week"
            detail="No restaurant has a shift in this week, so there is nothing to export."
          />
        ) : (
          <Alert
            title="Couldn't export the schedules"
            detail={toApiError(exportPdf.error).message}
          />
        ))}
      <div className={styles.list}>
        {restaurants.data.map((restaurant) => (
          <RestaurantSchedule
            key={restaurant.id}
            restaurant={restaurant}
            weekStart={weekStart}
            positions={positions.data}
            activePositionId={panel?.restaurantId === restaurant.id ? panel.positionId : null}
            onAddClick={(position) =>
              setPanel({ restaurantId: restaurant.id, positionId: position.id })
            }
          />
        ))}
      </div>
      {panelRestaurant && panelPosition && (
        <AddEmployeePanel
          restaurant={panelRestaurant}
          position={panelPosition}
          positions={positions.data}
          weekStart={weekStart}
          onClose={() => setPanel(null)}
        />
      )}
    </>
  );
}
