export type Field = "username" | "password";
export type Values = Record<Field, string>;
export type Errors = Partial<Record<Field, string>>;
export const FIELDS: Field[] = ["username", "password"];
export const EMPTY: Values = {
  username: "",
  password: "",
};

export function validate(values: Values): Errors {
  const errors: Errors = {};

  if (values.username.trim() === "") errors.username = "Enter your username.";
  if (values.password === "") errors.password = "Enter your password.";

  return errors;
}
