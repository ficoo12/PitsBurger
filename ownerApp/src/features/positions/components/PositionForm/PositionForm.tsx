import { useState, type FormEvent } from "react";
import { Alert } from "../../../../components/ui/Alert/Alert";
import { Button } from "../../../../components/ui/Button/Button";
import { TextField } from "../../../../components/ui/Input/TextField";
import { SwatchPicker } from "../../../../components/ui/SwatchPicker/SwatchPicker";
import { toApiError } from "../../../../lib/apiClient";
import { hueSwatches } from "../../../../lib/palette";
import type { CreatePositionInput, Position } from "../../types";
import styles from "./PositionForm.module.css";
import { toInput, validate, type Errors, type Values } from "./validation";

type PositionFormProps = {
  /** What the form starts with: emptyValues() for a new position. */
  initialValues: Values;
  /** The owner's other positions: their colours can't be picked. */
  others: Position[];
  submitLabel: string;
  /** The button's text while the request is running. */
  pendingLabel: string;
  /** Title of the alert for a failure that isn't about a field. */
  errorTitle: string;
  isPending: boolean;
  /** The mutation's error, if the last request failed. */
  error: unknown;
  /** Called on every edit, to clear the mutation's error. */
  onEdit: () => void;
  /** Called with the request body once the values are valid. */
  onSubmit: (input: CreatePositionInput) => void;
};

/**
 * The fields of a position: its name and its colour in the schedule, which
 * no other position may have. The page decides where the values go.
 */
export function PositionForm({
  initialValues,
  others,
  submitLabel,
  pendingLabel,
  errorTitle,
  isPending,
  error,
  onEdit,
  onSubmit,
}: PositionFormProps) {
  const [values, setValues] = useState<Values>(initialValues);
  const [submitted, setSubmitted] = useState(false);

  const serverError = error ? toApiError(error) : null;
  const colourError = serverError?.fields.colour?.[0];
  // A taken name (409) is about the name field too, so it is shown under it.
  // A taken colour is a 409 as well, but names its field.
  const serverFieldErrors: Errors = {
    name:
      serverError?.fields.name?.[0] ??
      (serverError?.status === 409 && !colourError ? serverError.message : undefined),
    colour: colourError,
  };
  const highlightsField =
    serverFieldErrors.name !== undefined || serverFieldErrors.colour !== undefined;
  const swatches = hueSwatches(others);
  // Nothing to pick: every colour belongs to another position.
  const allTaken = swatches.every((swatch) => swatch.takenBy !== undefined);
  const errors: Errors = {
    ...serverFieldErrors,
    ...(submitted ? validate(values) : {}),
  };

  function change(changes: Partial<Values>) {
    setValues({ ...values, ...changes });
    if (serverError) onEdit();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    setSubmitted(true);

    const clientErrors = validate(values);
    if (clientErrors.name) {
      const input = event.currentTarget.elements.namedItem("name");
      if (input instanceof HTMLInputElement) input.focus();
    }
    if (clientErrors.name || clientErrors.colour) return;

    onSubmit(toInput(values));
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {serverError && (
        <Alert
          title={highlightsField ? "Please check the highlighted fields." : errorTitle}
          detail={highlightsField ? undefined : serverError.message}
        />
      )}

      <TextField
        label="Name"
        name="name"
        autoComplete="off"
        required
        hint="Shared by all your restaurants, e.g. Service or Kitchen."
        value={values.name}
        error={errors.name}
        onChange={(event) => change({ name: event.target.value })}
      />

      <SwatchPicker
        legend="Colour"
        name="colour"
        options={swatches}
        value={values.colour}
        onChange={(colour) => change({ colour })}
        hint={
          allTaken
            ? "All colours are taken. Delete a position or change its colour first."
            : "Its zone and shifts in the schedule. Each position has its own colour."
        }
        error={errors.colour}
      />

      <Button type="submit" className={styles.submit} disabled={isPending || allTaken}>
        {isPending ? pendingLabel : submitLabel}
      </Button>
    </form>
  );
}
