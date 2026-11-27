import { useMemo } from "react";
import { Alert } from "../../../../components/ui/Alert/Alert";
import { SidePanel } from "../../../../components/ui/SidePanel/SidePanel";
import { Spinner } from "../../../../components/ui/Spinner/Spinner";
import { toApiError } from "../../../../lib/apiClient";
import { paletteVar } from "../../../../lib/palette";
import { fullName, useGetEmployees, type Employee } from "../../../employees";
import type { Position } from "../../../positions";
import type { Restaurant } from "../../../restaurants";
import { useAddedRows, useAddedRowsStore } from "../../addedRowsStore";
import { useGetSchedule } from "../../api/useGetSchedule";
import { DRAG_TYPE, type DraggedEmployee } from "../../dragEmployee";
import { scheduleZones } from "../../scheduleRows";
import { weekLabel } from "../../week";
import styles from "./AddEmployeePanel.module.css";

type AddEmployeePanelProps = {
  restaurant: Restaurant;
  /** The zone people are added to. */
  position: Position;
  /** The owner's positions, to know who is already in the zone. */
  positions: Position[];
  /** The shown week's Monday, "YYYY-MM-DD". */
  weekStart: string;
  onClose: () => void;
};

/**
 * The side panel of a zone's "+ Add employee": the restaurant's active
 * employees with a position in that zone who aren't in it this week yet. The
 * owner drags one onto the zone's rows or uses their Add button. The panel
 * stays open, so several people can be added one after another.
 */
export function AddEmployeePanel({
  restaurant,
  position,
  positions,
  weekStart,
  onClose,
}: AddEmployeePanelProps) {
  const employees = useGetEmployees(restaurant.id);
  const schedule = useGetSchedule(restaurant.id, weekStart);
  const added = useAddedRows(restaurant.id, weekStart);
  const add = useAddedRowsStore((state) => state.add);
  const zoneName = position.name;
  /** Whether the person is active and has this zone's position. */
  const fits = (employee: Employee) =>
    employee.status === "active" && employee.positions.some((item) => item.id === position.id);

  const candidates = useMemo(() => {
    if (employees.data === undefined || schedule.data === undefined) return undefined;
    const zone = scheduleZones(
      positions,
      employees.data,
      schedule.data.entries,
      added,
      schedule.data.availability,
    ).find((item) => item.position?.id === position.id);
    const inZone = new Set(zone?.rows.map((row) => row.employee.id));
    return employees.data.filter(
      (employee) =>
        employee.status === "active" &&
        employee.positions.some((item) => item.id === position.id) &&
        !inZone.has(employee.id),
    );
  }, [positions, employees.data, schedule.data, added, position.id]);

  const anyoneFits = employees.data?.some(fits);

  let content;
  if (candidates !== undefined) {
    content =
      candidates.length === 0 ? (
        <p className={styles.empty}>
          {anyoneFits
            ? `Everyone in ${zoneName} at ${restaurant.name} is already on this week.`
            : `No employees with a ${zoneName} position at ${restaurant.name}.`}
        </p>
      ) : (
        <>
          <p className={styles.hint}>
            Drag a person onto the {zoneName} rows, or use Add. Then set their shifts in the
            table.
          </p>
          <ul className={styles.list}>
            {candidates.map((employee) => {
              const name = fullName(employee);
              const dragged: DraggedEmployee = {
                employeeId: employee.id,
                restaurantId: restaurant.id,
                weekStart,
                positionId: position.id,
              };
              return (
                <li
                  key={employee.id}
                  className={styles.item}
                  style={{ background: paletteVar(position.colour, "early") }}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(dragged));
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                >
                  <div className={styles.person}>
                    <span className={styles.name}>{name}</span>
                    <span className={styles.positions}>
                      {employee.positions.map((position) => position.name).join(", ")}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.add}
                    aria-label={`Add ${name}`}
                    onClick={() =>
                      add(restaurant.id, weekStart, {
                        employeeId: employee.id,
                        positionId: position.id,
                      })
                    }
                  >
                    Add
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      );
  } else if (employees.isError || schedule.isError) {
    content = (
      <Alert
        title="Couldn't load the employees"
        detail={toApiError(employees.error ?? schedule.error).message}
      />
    );
  } else {
    content = <Spinner label="Loading employees" />;
  }

  return (
    <SidePanel
      title={`Add to ${zoneName}`}
      subtitle={`${restaurant.name} · ${weekLabel(weekStart)}`}
      onClose={onClose}
    >
      {content}
    </SidePanel>
  );
}
