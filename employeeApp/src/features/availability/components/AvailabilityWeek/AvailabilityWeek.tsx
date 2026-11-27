import { useEffect, useState } from "react";
import { Alert } from "../../../../components/ui/Alert/Alert";
import { Button } from "../../../../components/ui/Button/Button";
import { toApiError } from "../../../../lib/apiClient";
import { useSubmitAvailability } from "../../api/useSubmitAvailability";
import {
  changes,
  dateTime,
  dayMonth,
  isoWeek,
  weekdayName,
  weekdayShort,
  weekdayTime,
  weekRange,
  times,
} from "../../format";
import type { AvailabilityWeek as Week } from "../../types";
import { ConfirmSheet, type SummaryDay } from "../ConfirmSheet/ConfirmSheet";
import { NoteField, NoteText } from "../NoteField/NoteField";
import { noteForApi, validateNote } from "../NoteField/validation";
import { EmptyValue, ShiftPicker, ShiftValue } from "../ShiftPicker/ShiftPicker";
import { StatusBanner } from "../StatusBanner/StatusBanner";
import styles from "./AvailabilityWeek.module.css";

/** How long the black "Saved" toast stays. */
const TOAST_MS = 3000;

/** Weekday → picked shift id, or null for not available. */
type Picks = Record<number, number | null>;

function savedPicks(week: Week): Picks {
  const saved = new Map(week.submission?.days.map((day) => [day.weekday, day.shiftId]));
  // Every open day starts at "–", so the form is always complete.
  return Object.fromEntries(week.days.map((day) => [day.weekday, saved.get(day.weekday) ?? null]));
}

type AvailabilityWeekProps = {
  week: Week;
};

/**
 * The shown week: a shift per open day and a note, editable while the window
 * is open and changes are left, read-only otherwise. Mounted per week
 * (key = weekStart), so a new week starts from its own saved values.
 */
export function AvailabilityWeek({ week }: AvailabilityWeekProps) {
  const submit = useSubmitAvailability();
  const [picks, setPicks] = useState<Picks>(() => savedPicks(week));
  const [note, setNote] = useState(week.submission?.note ?? "");
  const [noteError, setNoteError] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (!showSaved) return;
    const timer = setTimeout(() => setShowSaved(false), TOAST_MS);
    return () => clearTimeout(timer);
  }, [showSaved]);

  const editable = week.isOpen && week.savesLeft > 0;
  const firstSubmit = week.submission === null;
  const shiftName = new Map(week.shifts.map((shift) => [shift.id, shift.name]));
  const saved = savedPicks(week);
  const dirty =
    week.days.some((day) => picks[day.weekday] !== saved[day.weekday]) ||
    noteForApi(note) !== (week.submission?.note ?? null);
  // After the save that is about to happen.
  const changesAfter = Math.max(week.savesLeft - 1, 0);
  const kw = isoWeek(week.weekStart);
  const closes = weekdayTime(week.window.closesWeekday, week.window.closesTime);

  const serverError = submit.error ? toApiError(submit.error) : null;
  const daysError = serverError?.fields.days?.[0];
  const noteServerError = serverError?.fields.note?.[0];
  // A message that isn't about one of the fields (409, 500, offline).
  const generalError = serverError && !daysError && !noteServerError ? serverError : null;

  function changed() {
    if (submit.isError) submit.reset();
  }

  function save() {
    const error = validateNote(note);
    setNoteError(error);
    if (error) return;
    submit.mutate(
      {
        days: week.days
          .filter((day) => picks[day.weekday] !== null)
          .map((day) => ({ weekday: day.weekday, shiftId: picks[day.weekday]! })),
        note: noteForApi(note),
      },
      {
        onSuccess: () => {
          setConfirming(false);
          setShowSaved(true);
        },
        onError: () => setConfirming(false),
      },
    );
  }

  function handleAction() {
    const error = validateNote(note);
    setNoteError(error);
    if (error) return;
    if (firstSubmit) setConfirming(true);
    else save();
  }

  // Monday to Sunday for the confirmation sheet; closed days are grey.
  const summary: SummaryDay[] = [1, 2, 3, 4, 5, 6, 7].map((weekday) => {
    const open = week.days.some((day) => day.weekday === weekday);
    const shiftId = picks[weekday] ?? null;
    const name = shiftId === null ? null : (shiftName.get(shiftId) ?? null);
    const value = !open ? "" : (name ?? "–");
    return {
      label: weekdayShort(weekday),
      value,
      tone: !open ? "closed" : name === null ? "none" : "plain",
      description: `${weekdayName(weekday)}: ${!open ? "closed" : (name ?? "not available")}`,
    };
  });

  return (
    <>
      <main className={styles.body}>
        {showSaved && (
          <div className={styles.toast}>
            <StatusBanner
              tone="saved"
              title="Saved"
              detail={`Your availability for week ${kw} is submitted.`}
            />
          </div>
        )}

        <div className={styles.head}>
          <span className={styles.eyebrow}>For week {kw}</span>
          <h1>Availability</h1>
          <p>{weekRange(week.weekStart)}</p>
        </div>

        <Banner week={week} kw={kw} closes={closes} changesAfter={changesAfter} />

        {editable && week.shifts.length === 0 && (
          <Alert
            tone="neutral"
            title="No shifts yet"
            detail="Your manager hasn't set up any shifts. You can only mark days as not available."
          />
        )}

        {week.days.length === 0 ? (
          <p className={styles.empty}>Your restaurant isn't open on any day this week.</p>
        ) : (
          <div>
            <ul className={styles.days} aria-label="Days">
              {week.days.map((day) => {
                const label = `${weekdayName(day.weekday)} ${dayMonth(day.date)}`;
                const shiftId = picks[day.weekday] ?? null;
                return (
                  <li key={day.weekday} className={styles.day}>
                    <div className={styles.date}>
                      <strong>{weekdayName(day.weekday)}</strong>
                      <span>{dayMonth(day.date)}</span>
                    </div>
                    {editable ? (
                      <ShiftPicker
                        label={label}
                        shifts={week.shifts}
                        value={shiftId}
                        onChange={(id) => {
                          setPicks((current) => ({ ...current, [day.weekday]: id }));
                          changed();
                        }}
                      />
                    ) : week.submission ? (
                      <ShiftValue
                        name={shiftId === null ? null : (shiftName.get(shiftId) ?? null)}
                      />
                    ) : (
                      <EmptyValue />
                    )}
                  </li>
                );
              })}
            </ul>
            {daysError && (
              <p className={styles.fieldError} role="alert">
                {daysError}
              </p>
            )}
          </div>
        )}

        {editable ? (
          <NoteField
            value={note}
            error={noteError ?? noteServerError}
            onChange={(value) => {
              setNote(value);
              if (noteError) setNoteError(validateNote(value));
              changed();
            }}
          />
        ) : (
          week.submission?.note && <NoteText note={week.submission.note} />
        )}

        {generalError && <Alert title="Couldn't save" detail={generalError.message} />}
      </main>

      {editable && week.days.length > 0 && (
        <div className={styles.action}>
          <div className={styles.actionInner}>
            <Button
              size="lg"
              block
              disabled={(!firstSubmit && !dirty) || submit.isPending}
              onClick={handleAction}
            >
              {submit.isPending && !confirming
                ? "Saving …"
                : firstSubmit
                  ? "Submit"
                  : "Save changes"}
            </Button>
            <p>
              {firstSubmit
                ? changesAfter > 0
                  ? `After submitting you can change it ${times(changesAfter)}.`
                  : "After submitting you can't change it."
                : !dirty
                  ? "Change a day to save."
                  : changesAfter > 0
                    ? `After this you have ${changes(changesAfter)} left.`
                    : "After this you can't make more changes."}
            </p>
          </div>
        </div>
      )}

      {confirming && (
        <ConfirmSheet
          days={summary}
          changesAfter={changesAfter}
          closes={closes}
          pending={submit.isPending}
          onConfirm={save}
          onClose={() => setConfirming(false)}
        />
      )}
    </>
  );
}

type BannerProps = {
  week: Week;
  kw: number;
  closes: string;
  changesAfter: number;
};

/** The window state and the changes left, worded for this week. */
function Banner({ week, kw, closes, changesAfter }: BannerProps) {
  if (!week.isOpen) {
    const next = week.nextOpening
      ? ` You can enter next week's availability from ${dateTime(week.nextOpening.date, week.nextOpening.time)}.`
      : "";
    return (
      <StatusBanner
        tone="closed"
        title="Entries closed"
        detail={
          (week.submission
            ? `This is what you submitted for week ${kw}.`
            : `You didn't submit anything for week ${kw}.`) + next
        }
      />
    );
  }
  if (week.savesLeft === 0) {
    return (
      <StatusBanner
        tone="locked"
        title="No changes left"
        detail="You've used all your changes. Ask your manager if something needs to change."
      />
    );
  }
  if (week.submission === null) {
    return (
      <StatusBanner
        tone="open"
        title="You can enter your availability"
        detail={`Until ${closes} · ${
          changesAfter > 0
            ? `after submitting you can change it ${times(changesAfter)}`
            : "after submitting you can't change it"
        }`}
      />
    );
  }
  return (
    <StatusBanner
      tone="open"
      title={`Open · ${changes(week.savesLeft)} left`}
      detail={`Until ${closes}`}
      pips={{ total: Math.max(week.maxSaves - 1, week.savesLeft), left: week.savesLeft }}
    />
  );
}
