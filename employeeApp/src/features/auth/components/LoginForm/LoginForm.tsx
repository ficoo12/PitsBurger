import { useState, type ChangeEvent, type FormEvent } from "react";
import { Alert } from "../../../../components/ui/Alert/Alert";
import { Button } from "../../../../components/ui/Button/Button";
import { PasswordField } from "../../../../components/ui/Input/PasswordField";
import { TextField } from "../../../../components/ui/Input/TextField";
import { toApiError } from "../../../../lib/apiClient";
import { useLogin } from "../../api/useLogin";
import styles from "./LoginForm.module.css";
import {
  EMPTY,
  FIELDS,
  validate,
  type Errors,
  type Field,
  type Values,
} from "./validation";

/**
 * Username and password login for employees (POST /employees/login). On
 * success the session holds an employee, and the guest Guard sends them on to
 * the availability page.
 */
export function LoginForm() {
  const login = useLogin();
  const [values, setValues] = useState<Values>(EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const serverError = login.error ? toApiError(login.error) : null;
  // A 400 has its messages under the fields. Everything else (wrong login, too
  // many attempts, no connection) is the server's message as it is.
  const alertTitle =
    serverError &&
    (serverError.status === 400
      ? "Please check the highlighted fields."
      : serverError.message);
  const serverFieldErrors: Errors = {
    username: serverError?.fields.username?.[0],
    password: serverError?.fields.password?.[0],
  };
  const errors: Errors = {
    ...serverFieldErrors,
    ...(submitted ? validate(values) : {}),
  };

  function change(field: Field) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target;
      setValues((prev) => ({ ...prev, [field]: value }));
      if (login.isError) login.reset();
    };
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (login.isPending) return;
    setSubmitted(true);

    const clientErrors = validate(values);
    const firstInvalid = FIELDS.find((field) => clientErrors[field]);
    if (firstInvalid) {
      const input = event.currentTarget.elements.namedItem(firstInvalid);
      if (input instanceof HTMLInputElement) input.focus();
      return;
    }

    login.mutate({
      username: values.username.trim(),
      password: values.password,
    });
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {alertTitle && <Alert title={alertTitle} />}
      <TextField
        label="Username"
        size="lg"
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        required
        value={values.username}
        error={errors.username}
        onChange={change("username")}
      />

      <PasswordField
        label="Password"
        size="lg"
        name="password"
        autoComplete="current-password"
        required
        value={values.password}
        error={errors.password}
        onChange={change("password")}
      />
      <Button type="submit" size="lg" block disabled={login.isPending}>
        {login.isPending ? "Logging in …" : "Log in"}
      </Button>
    </form>
  );
}
