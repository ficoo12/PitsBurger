import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "../Icon/Icon";
import styles from "./Input.module.css";
import { TextField, type TextFieldProps } from "./TextField";

/** A labelled password input with a show / hide toggle. */
export function PasswordField(props: Omit<TextFieldProps, "type" | "trailing">) {
  const [visible, setVisible] = useState(false);

  return (
    <TextField
      {...props}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          className={styles.toggle}
          aria-label="Show password"
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      }
    />
  );
}
