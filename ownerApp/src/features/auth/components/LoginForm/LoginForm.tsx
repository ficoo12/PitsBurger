import { useState, type ChangeEvent, type FormEvent } from "react";
import { Button } from "../../../../components/ui/Button/Button";
import { PasswordField } from "../../../../components/ui/Input/PasswordField";
import { TextField } from "../../../../components/ui/Input/TextField";
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
import { ApiError, toApiError } from "../../../../lib/apiClient";
import { Alert } from "../../../../components/ui/Alert/Alert";

function alertFor(error: ApiError): { title: string; detail?: string } {
  if (error.status === 400)
    return { title: "Please check the highlighted fields." };
  if (error.status === 429) {
    return {
      title: error.message,
      detail: "Too many attempts try again later",
    };
  }
  return { title: error.message };
}

export function LoginForm() {
  const login = useLogin();
  const [values, setValues] = useState<Values>(EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const serverError = login.error ? toApiError(login.error) : null;
  const alert = serverError && alertFor(serverError);
  const serverFieldErrors: Errors = {
    email: serverError?.fields.email?.[0],
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
      email: values.email.trim(),
      password: values.password,
    });
  }
  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {alert && <Alert title={alert.title} detail={alert.detail} />}
      <TextField
        label="Email"
        size="lg"
        type="email"
        name="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        value={values.email}
        error={errors.email}
        onChange={change("email")}
      />

      <PasswordField
        label="Password"
        value={values.password}
        error={errors.password}
        size="lg"
        onChange={change("password")}
        name="password"
        autoComplete="current-password"
        required
      />
      <Button type="submit" size="lg" block disabled={login.isPending}>
        {login.isPending ? "Logging in …" : "Log in"}
      </Button>
    </form>
  );
}
