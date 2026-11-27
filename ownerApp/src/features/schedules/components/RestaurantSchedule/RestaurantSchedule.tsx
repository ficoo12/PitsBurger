import {
  useId,
  useMemo,
  useState,
  type CSSProperties,
  type DragEvent,
  type ReactNode,
} from "react";
import { Alert } from "../../../../components/ui/Alert/Alert";
import { Spinner } from "../../../../components/ui/Spinner/Spinner";
import { toApiError } from "../../../../lib/apiClient";
import { paletteVar, restaurantGradient } from "../../../../lib/palette";
import { fullName, useGetEmployees } from "../../../employees";
import type { Position } from "../../../positions";
import type { Restaurant } from "../../../restaurants";
import { useAddedRows, useAddedRowsStore } from "../../addedRowsStore";
import { useGetSchedule } from "../../api/useGetSchedule";
import { DRAG_TYPE, readDraggedEmployee } from "../../dragEmployee";
import {
  cellShade,
  scheduleZones,
  shiftLabel,
  shiftTimes,
  type ScheduleRow,
} from "../../scheduleRows";
import { weekDays, type WeekDay } from "../../week";
import { AvailabilityNote } from "../AvailabilityNote/AvailabilityNote";
import { CellEditor } from "../CellEditor/CellEditor";
import { RemoveFromWeek } from "../RemoveFromWeek/RemoveFromWeek";
import styles from "./RestaurantSchedule.module.css";

/** The cell whose editor is open. */
type Editing = {
  row: ScheduleRow;
  day: WeekDay;
  /** The cell's button, which the editor sits under. */
  anchor: HTMLElement;
  /** The week it was opened in: moving to another week closes it. */
  weekStart: string;
};

type RestaurantScheduleProps = {
  restaurant: Restaurant;
  /** The shown week's Monday, "YYYY-MM-DD". */
  weekStart: string;
  /** The owner's positions: one zone each, in the order they were created. */
  positions: Position[];
  /** The zone (position id) whose add panel is open for this restaurant: only it takes drops. */
  activePositionId: number | null;
  /** A zone's "+ Add employee" was clicked. */
  onAddClick: (position: Position) => void;
};

/** A CSS custom property set on one element, e.g. the colour a cell is filled with. */
function cssVar(name: string, value: string): CSSProperties {
  return { [name]: value } as CSSProperties;
}

/**
 * One restaurant's week, drawn like the Excel plans (design system:
 * ScheduleTable): the restaurant's name in a merged column in its colour on
 * the left, then a zone per position in the position's colour, one column per
 * day.
 *
 * A zone lists only the people on this week: those with a saved shift here,
 * those whose availability is shown here and those the owner added, each
 * zone ending in a "+ Add employee" row. Clicking a name offers to take the
 * person out of the week again; a red dot after it opens their note. A cell
 * is coloured by the zone's colour in the shift's shade ("Spät ab 18:00 | 336"); a day without a
 * shift is black, and grey when the restaurant is closed. A day the person
 * said they can work, without a shift yet, shows that shift as a hint: a
 * dashed frame and "Früh?" in the shift's colour.
 *
 * Clicking a cell opens an editor under it to save, change or clear that
 * day's shift, or to accept or dismiss its hint. Someone who has left gets no
 * new shifts, so only their saved cells can be clicked.
 */
export function RestaurantSchedule({
  restaurant,
  weekStart,
  positions,
  activePositionId,
  onAddClick,
}: RestaurantScheduleProps) {
  const headingId = useId();
  const employees = useGetEmployees(restaurant.id);
  const schedule = useGetSchedule(restaurant.id, weekStart);
  const added = useAddedRows(restaurant.id, weekStart);
  const addRow = useAddedRowsStore((state) => state.add);
  const removeRow = useAddedRowsStore((state) => state.remove);
  /** The row whose remove window is open. */
  const [removing, setRemoving] = useState<ScheduleRow | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  /** The zone (position id) a person is being dragged over. */
  const [dropZone, setDropZone] = useState<number | null>(null);

  const zones = useMemo(
    () =>
      employees.data && schedule.data
        ? scheduleZones(
            positions,
            employees.data,
            schedule.data.entries,
            added,
            schedule.data.availability,
          )
        : undefined,
    [positions, employees.data, schedule.data, added],
  );

  const days = weekDays(weekStart);
  const openWeekdays = new Set(restaurant.openingHours.map((hours) => hours.weekday));
  const shifts = new Map(restaurant.shiftTimes.map((shift) => [shift.shiftId, shift]));

  /** The zone under the pointer, when it is the one whose panel is open. */
  function zoneAt(event: DragEvent): number | null {
    if (activePositionId === null || !(event.target instanceof Element)) return null;
    const zone = event.target.closest("tr[data-zone]")?.getAttribute("data-zone");
    return zone === String(activePositionId) ? activePositionId : null;
  }

  function handleDragOver(event: DragEvent<HTMLTableSectionElement>) {
    if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;
    const zone = zoneAt(event);
    setDropZone(zone);
    if (zone === null) return; // not calling preventDefault: no drop here
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function handleDrop(event: DragEvent<HTMLTableSectionElement>) {
    event.preventDefault();
    setDropZone(null);
    const dragged = readDraggedEmployee(event.dataTransfer);
    const zone = zoneAt(event);
    if (
      dragged &&
      zone !== null &&
      dragged.positionId === zone &&
      dragged.restaurantId === restaurant.id &&
      dragged.weekStart === weekStart
    ) {
      addRow(restaurant.id, weekStart, { employeeId: dragged.employeeId, positionId: zone });
    }
  }

  function personRow(row: ScheduleRow): ReactNode[] {
    const name = fullName(row.employee);
    const colour = row.position?.colour;
    return [
      // The name in the zone's colour (its Early shade); white without a zone.
      <th
        key="name"
        scope="row"
        className={styles.name}
        style={colour ? { background: paletteVar(colour, "early") } : undefined}
      >
        <div className={styles.nameLine}>
          <button type="button" className={styles.nameButton} onClick={() => setRemoving(row)}>
            {name}
            {row.employee.status === "left" && <span className={styles.meta}>Left</span>}
          </button>
          {row.note !== null && <AvailabilityNote name={name} note={row.note} />}
        </div>
      </th>,
      ...days.map((day) => {
        const entry = row.cells.get(day.date);
        const shift = entry && shifts.get(entry.shiftId);
        // A saved shift wins over the hint for the same day.
        const hintId = entry ? undefined : row.hints.get(day.date);
        const hint = hintId === undefined ? undefined : shifts.get(hintId);
        const hintName = hint?.name ?? "Unknown shift";
        const label = entry ? shiftLabel(entry, shift) : hintId !== undefined ? `${hintName}?` : "";
        // A hint's text has its own element: on a closed day it is drawn as a tag.
        const content =
          hintId !== undefined ? <span className={styles.hintLabel}>{label}</span> : label;
        const ariaLabel = entry
          ? label
          : hintId !== undefined
            ? `available for ${hintName}`
            : "no shift";
        // Someone who has left gets no new shifts; their saved ones stay editable.
        const editable = entry !== undefined || row.employee.status === "active";
        const closed = !openWeekdays.has(day.weekday);
        const shade = cellShade(entry, shift, closed);
        // A saved shift fills the cell in the zone's colour and the shift's
        // shade; a hint draws its frame and name in that colour instead.
        // Without a zone, or for a shift the restaurant doesn't have, it stays white.
        const fill =
          colour && (shade === "early" || shade === "late" || shade === "full")
            ? paletteVar(colour, shade)
            : undefined;
        const hintColour = colour && hint ? paletteVar(colour, hint.shade) : undefined;
        return (
          <td
            key={day.date}
            className={styles.cell}
            data-shift={shade}
            data-fill={fill ? true : undefined}
            data-hint={hintId === undefined ? undefined : (hint?.shade ?? "other")}
            style={
              fill
                ? cssVar("--cell-fill", fill)
                : hintColour
                  ? cssVar("--hint-colour", hintColour)
                  : undefined
            }
            title={
              entry
                ? (shiftTimes(entry, shift) ?? undefined)
                : hint
                  ? `Available for ${hint.name}, ${hint.startTime}–${hint.endTime}`
                  : undefined
            }
          >
            {editable ? (
              <button
                type="button"
                className={styles.cellButton}
                aria-label={`${name}, ${day.name} ${day.label}: ${ariaLabel}`}
                aria-haspopup="dialog"
                aria-expanded={
                  editing?.weekStart === weekStart &&
                  editing.row.employee.id === row.employee.id &&
                  editing.row.position?.id === row.position?.id &&
                  editing.day.date === day.date
                }
                onClick={(event) =>
                  setEditing({ row, day, anchor: event.currentTarget, weekStart })
                }
              >
                {content}
              </button>
            ) : (
              content
            )}
          </td>
        );
      }),
    ];
  }

  function addRowCells(position: Position): ReactNode[] {
    const zoneName = position.name;
    const active = activePositionId === position.id;
    const dropping = dropZone === position.id;
    return [
      <th
        key="name"
        scope="row"
        className={styles.addCell}
        style={{ background: paletteVar(position.colour, "early") }}
      >
        <button
          type="button"
          className={styles.addButton}
          aria-label={`Add employee to ${zoneName} in ${restaurant.name}`}
          aria-expanded={active}
          onClick={() => onAddClick(position)}
        >
          + Add employee
        </button>
      </th>,
      <td
        key="days"
        colSpan={days.length}
        className={styles.addDays}
        data-active={active || undefined}
        data-dropping={dropping || undefined}
      >
        {active && (dropping ? "Drop to add" : `Drag people here to add them to ${zoneName}`)}
      </td>,
    ];
  }

  // Only without data: a table that is already loaded stays on screen when a
  // refresh in the background fails (isError is true then, too).
  let content;
  if (employees.data === undefined) {
    content = employees.isError ? (
      <Alert title="Couldn't load employees" detail={toApiError(employees.error).message} />
    ) : (
      <Spinner label={`Loading the employees of ${restaurant.name}`} />
    );
  } else if (schedule.data === undefined || zones === undefined) {
    content = schedule.isError ? (
      <Alert title="Couldn't load the schedule" detail={toApiError(schedule.error).message} />
    ) : (
      <Spinner label={`Loading the schedule of ${restaurant.name}`} />
    );
  } else {
    // Every line of the table body, zone after zone: its people, then its add row.
    const lines = zones.flatMap((zone) => {
      const zoneKey = zone.position ? String(zone.position.id) : "other";
      return [
        ...zone.rows.map((row) => ({
          key: `${zoneKey}-${row.employee.id}`,
          zone: zoneKey,
          cells: personRow(row),
        })),
        ...(zone.position === null
          ? []
          : [{ key: `${zoneKey}-add`, zone: zoneKey, cells: addRowCells(zone.position) }]),
      ];
    });

    content = (
      <div className={styles.scroll}>
        <table className={styles.table} aria-labelledby={headingId}>
          <colgroup>
            <col className={styles.restaurantColumn} />
            <col className={styles.nameColumn} />
            {/* The day columns have no width of their own: they share what is left. */}
            {days.map((day) => (
              <col key={day.date} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <td className={styles.corner} colSpan={2} rowSpan={2} />
              {days.map((day) => (
                <th key={day.date} scope="col" className={styles.weekday}>
                  {day.name}
                </th>
              ))}
            </tr>
            <tr>
              {days.map((day) => (
                <th key={day.date} scope="col">
                  {day.label}
                  {!openWeekdays.has(day.weekday) && (
                    <span className={styles.closedLabel}>Closed</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          {/* One body for all zones: the restaurant cell's rowSpan can't reach into another. */}
          <tbody
            onDragOver={handleDragOver}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setDropZone(null);
              }
            }}
            onDrop={handleDrop}
          >
            {lines.map((line, index) => (
              <tr key={line.key} data-zone={line.zone}>
                {index === 0 && (
                  <th
                    scope="rowgroup"
                    rowSpan={lines.length}
                    className={styles.restaurant}
                    style={{ background: restaurantGradient(restaurant.colour) }}
                  >
                    {restaurant.name}
                  </th>
                )}
                {line.cells}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <section className={styles.section}>
      {/* The name shows in the table's left column; this heading is for screen readers. */}
      <h2 id={headingId} className={styles.visuallyHidden}>
        {restaurant.name}
      </h2>
      {content}
      {editing && editing.weekStart === weekStart && (
        <CellEditor
          // A new cell gets a fresh form.
          key={`${editing.row.position?.id ?? "other"}-${editing.row.employee.id}-${editing.day.date}`}
          anchor={editing.anchor}
          restaurant={restaurant}
          weekStart={weekStart}
          row={editing.row}
          day={editing.day}
          entry={editing.row.cells.get(editing.day.date)}
          hint={editing.row.hints.get(editing.day.date)}
          closed={!openWeekdays.has(editing.day.weekday)}
          onClose={() => setEditing(null)}
        />
      )}
      {removing && (
        <RemoveFromWeek
          row={removing}
          restaurantName={restaurant.name}
          weekStart={weekStart}
          onRemove={() => {
            if (removing.position) {
              removeRow(restaurant.id, weekStart, {
                employeeId: removing.employee.id,
                positionId: removing.position.id,
              });
            }
          }}
          onClose={() => setRemoving(null)}
        />
      )}
    </section>
  );
}
