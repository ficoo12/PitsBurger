export type Field = "email" | "password";
export type Values = Record<Field, string>;
export type Errors = Partial<Record<Field, string>>;
export const FIELDS: Field[] = ["email", "password"];
export const EMPTY: Values = {
  email: "",
  password: "",
};

export function validate(values: Values): Errors {
  const errors: Errors = {};

  const email = values.email.trim();
  if (email === "") errors.email = "Enter your email address.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email address, like name@example.com.";
  }

  if (values.password === "") errors.password = "Enter your password.";

  return errors;
}
