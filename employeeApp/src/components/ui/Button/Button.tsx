import type { ButtonHTMLAttributes } from "react";
import { Link, type LinkProps } from "react-router";
import styles from "./Button.module.css";

type ButtonLook = {
  /** primary: the one main action per view; secondary: cancel / neutral. */
  variant?: "primary" | "secondary";
  size?: "md" | "lg";
  /** Full width of the parent. */
  block?: boolean;
};

function buttonClasses({ variant = "primary", size = "md", block = false }: ButtonLook, extra?: string) {
  return [styles.button, styles[variant], size === "lg" && styles.lg, block && styles.block, extra]
    .filter(Boolean)
    .join(" ");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & ButtonLook;

export function Button({ variant, size, block, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses({ variant, size, block }, className)} {...props} />;
}

/** A link to another page that looks like a button. */
export function ButtonLink({ variant, size, block, className, ...props }: LinkProps & ButtonLook) {
  return <Link className={buttonClasses({ variant, size, block }, className)} {...props} />;
}
