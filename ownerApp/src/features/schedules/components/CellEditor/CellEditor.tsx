import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  shift as shiftAway,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import { useId, useState, type FormEvent } from "react";
import { Alert } from "../../../../components/ui/Alert/Alert";
import { Button } from "../../../../components/ui/Button/Button";
import { TextField } from "../../../../components/ui/Input/TextField";
import { toApiError } from "../../../../lib/apiClient";
import { paletteVar } from "../../../../lib/palette";
import { fullName } from "../../../employees";
import type { Restaurant } from "../../../restaurants";
import { useAddedRowsStore } from "../../addedRowsStore";
import { useCreateEntry } from "../../api/useCreateEntry";
import { useDeleteEntry } from "../../api/useDeleteEntry";
import { useDismissAvailability } from "../../api/useDismissAvailability";
import { useEditEntry } from "../../api/useEditEntry";
import type { ScheduleRow } from "../../scheduleRows";
import type { ScheduleEntry } from "../../types";
import type { WeekDay } from "../../week";
import {
  fromEntry,
  fromHint,
  isHintAsIs,
  NOTE_MAX,
  toInput,
  validate,
  type Errors,
  type Values,
} from "./validation";
import styles from "./CellEditor.module.css";

type CellEditorProps = {
  /** The clicked cell's button: the popover sits under it and gives the focus back to it. */
  anchor: HTMLElement;
  restaurant: Restaurant;
  /** The shown week's Monday, "YYYY-MM-DD". */
  weekStart: string;
  row: ScheduleRow;
  day: WeekDay;
  /** The cell's saved shift, or undefined for an empty cell. */
  entry: ScheduleEntry | undefined;
  /**
   * The shift the person said they can work this day (its id), or undefined.
   * Only used for an empty cell: a saved shift wins.
   */
  hint: number | undefined;
  /** The restaurant is closed on this day. A shift can still be saved. */
  closed: boolean;
  /** Called when the popover should go away: cancelled, saved or cleared. */
  onClose: () => void;
};

/**
 * A popover under a schedule cell that saves, changes or clears one
 * person's shift on one day. The owner picks one of the restaurant's shifts
 * and can change its start or end for this day ("Spät ab 18:00") and add a
 * note ("181").
 *
 * An empty cell with an availability hint opens with the hint's shift
 * picked: "Accept" saves it as it is, and once anything is changed the
 * button says "Save". "Dismiss" hides the hint without a shift.
 *
 * It isn't modal: Escape or a click outside closes it (not while a request
 * runs), and the focus goes back to the cell.
 */
export function CellEditor({
  anchor,
  restaurant,
  weekStart,
  row,
  day,
  entry,
  hint: hintProp,
  closed,
  onClose,
}: CellEditorProps) {
  const hint = entry ? undefined : hintProp;
  const titleId = useId();
  const create = useCreateEntry(restaurant.id, weekStart);
  const edit = useEditEntry(restaurant.id, weekStart);
  const clear = useDeleteEntry(restaurant.id, weekStart);
  const dismiss = useDismissAvailability(restaurant.id, weekStart);
  const addRow = useAddedRowsStore((state) => state.add);
  const mutations = [create, edit, clear, dismiss];
  const pending = mutations.some((mutation) => mutation.isPending);
  const saving = create.isPending || edit.isPending;

  const [values, setValues] = useState<Values>(() =>
    hint === undefined ? fromEntry(entry) : fromHint(hint),
  );
  const accepting = hint !== undefined && isHintAsIs(values, hint);
  const [submitted, setSubmitted] = useState(false);

  const failed = mutations.find((mutation) => mutation.isError);
  const serverError = failed ? toApiError(failed.error) : null;
  const errors: Errors = {
    shiftId: serverError?.fields.shiftId?.[0],
    startTime: serverError?.fields.startTime?.[0],
    endTime: serverError?.fields.endTime?.[0],
    note: serverError?.fields.note?.[0],
    ...(submitted ? validate(values, restaurant.shiftTimes) : {}),
  };
  // "This employee has left" and "doesn't work in this restaurant" belong to
  // no input, so the banner says them.
  const rowError = serverError?.fields.employeeId?.[0] ?? serverError?.fields.restaurantId?.[0];
  const bannerDetail =
    rowError ?? (serverError?.status === 400 ? undefined : serverError?.message);

  const {
    refs: { setFloating },
    floatingStyles,
    context,
  } = useFloating({
    open: true,
    onOpenChange: (open) => {
      if (!open) onClose();
    },
    elements: { reference: anchor },
    placement: "bottom",
    middleware: [offset(6), flip({ padding: 8 }), shiftAway({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  // Escape and a click outside close it, but not while a request runs, so its result is seen.
  const dismissOnOutside = useDismiss(context, { enabled: !pending });
  const role = useRole(context, { role: "dialog" });
  const { getFloatingProps } = useInteractions([dismissOnOutside, role]);

  /**
   * A week lists only people with a shift, availability or an added row:
   * without this, clearing the last shift or dismissing the last hint would
   * take the row off the table.
   */
  function keepRow() {
    if (row.position) {
      addRow(restaurant.id, weekStart, {
        employeeId: row.employee.id,
        positionId: row.position.id,
      });
    }
  }

  function change(next: Values) {
    setValues(next);
    for (const mutation of mutations) if (mutation.isError) mutation.reset();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setSubmitted(true);
    const found = validate(values, restaurant.shiftTimes);
    if (Object.values(found).some(Boolean)) return;

    const input = toInput(values);
    if (entry) {
      edit.mutate({ id: entry.id, input }, { onSuccess: onClose });
    } else {
      create.mutate(
        { ...input, employeeId: row.employee.id, restaurantId: restaurant.id, workDate: day.date },
        { onSuccess: onClose },
      );
    }
  }

  const name = fullName(row.employee);
  const hasShifts = restaurant.shiftTimes.length > 0;
  const hintName =
    hint === undefined
      ? undefined
      : (restaurant.shiftTimes.find((shift) => shift.shiftId === hint)?.name ?? "Unknown shift");

  return (
    <FloatingPortal>
      <FloatingFocusManager context={context} modal={false} returnFocus>
        <div
          ref={setFloating}
          style={floatingStyles}
          className={styles.popover}
          aria-labelledby={titleId}
          {...getFloatingProps()}
        >
          <header className={styles.header}>
            <h2 id={titleId} className={styles.title}>
              {name}
            </h2>
            <p className={styles.subtitle}>
              {day.name} {day.label}
              {row.position && ` · ${row.position.name}`}
              {closed && " · Closed"}
            </p>
            {hintName && <p className={styles.available}>Available: {hintName}</p>}
          </header>

          {!hasShifts ? (
            <>
              <Alert
                tone="neutral"
                title="No shifts yet"
                detail={`Add shift times to ${restaurant.name} first.`}
              />
              <div className={styles.buttons}>
                <Button variant="secondary" onClick={onClose}>
                  Close
                </Button>
              </div>
            </>
          ) : (
            <form className={styles.form} onSubmit={handleSubmit} noValidate>
              {serverError && (
                <Alert
                  title={
                    serverError.status === 400 && !rowError
                      ? "Please check the highlighted fields."
                      : clear.isError
                        ? "Couldn't clear the shift"
                        : dismiss.isError
                          ? "Couldn't dismiss the availability"
                          : "Couldn't save the shift"
                  }
                  detail={bannerDetail}
                />
              )}

              <fieldset
                className={styles.shifts}
                aria-invalid={errors.shiftId ? true : undefined}
              >
                <legend className={styles.legend}>Shift</legend>
                <div className={styles.chips}>
                  {restaurant.shiftTimes.map((shift) => (
                    <label
                      key={shift.shiftId}
                      className={styles.chip}
                      // In the colour the cell will have; white without a zone.
                      style={
                        row.position
                          ? { background: paletteVar(row.position.colour, shift.shade) }
                          : undefined
                      }
                    >
                      <input
                        type="radio"
                        name="shiftId"
                        className={styles.radio}
                        checked={values.shiftId === shift.shiftId}
                        disabled={pending}
                        onChange={() => change({ ...values, shiftId: shift.shiftId })}
                      />
                      <span className={styles.chipName}>{shift.name}</span>
                      <span className={styles.chipTimes}>
                        {shift.startTime}–{shift.endTime}
                      </span>
                    </label>
                  ))}
                </div>
                {errors.shiftId && <span className={styles.error}>{errors.shiftId}</span>}
              </fieldset>

              <div className={styles.times}>
                <TextField
                  type="time"
                  label="From"
                  name="startTime"
                  hint="Empty: shift start"
                  value={values.startTime}
                  error={errors.startTime}
                  disabled={pending}
                  onChange={(event) => change({ ...values, startTime: event.target.value })}
                />
                <TextField
                  type="time"
                  label="To"
                  name="endTime"
                  hint="Empty: shift end"
                  value={values.endTime}
                  error={errors.endTime}
                  disabled={pending}
                  onChange={(event) => change({ ...values, endTime: event.target.value })}
                />
              </div>

              <TextField
                label="Note"
                name="note"
                autoComplete="off"
                maxLength={NOTE_MAX}
                value={values.note}
                error={errors.note}
                disabled={pending}
                onChange={(event) => change({ ...values, note: event.target.value })}
              />

              <div className={styles.buttons}>
                {entry && (
                  <Button
                    variant="secondary"
                    className={styles.clear}
                    disabled={pending}
                    onClick={() =>
                      clear.mutate(entry.id, {
                        onSuccess: () => {
                          keepRow();
                          onClose();
                        },
                      })
                    }
                  >
                    {clear.isPending ? "Clearing …" : "Clear shift"}
                  </Button>
                )}
                {hint !== undefined && (
                  <Button
                    variant="secondary"
                    className={styles.clear}
                    disabled={pending}
                    onClick={() =>
                      dismiss.mutate(
                        { employeeId: row.employee.id, date: day.date },
                        {
                          onSuccess: () => {
                            keepRow();
                            onClose();
                          },
                        },
                      )
                    }
                  >
                    {dismiss.isPending ? "Dismissing …" : "Dismiss"}
                  </Button>
                )}
                <Button type="submit" disabled={pending}>
                  {accepting
                    ? saving
                      ? "Accepting …"
                      : "Accept"
                    : saving
                      ? "Saving …"
                      : "Save"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </FloatingFocusManager>
    </FloatingPortal>
  );
}
