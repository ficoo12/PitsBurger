import styles from "./Logo.module.css";

type LogoProps = {
  /** Name size: 16px in the app, 20px on the login page. */
  size?: 48 | 56;
};

/**
 * "Pit's Burger / Manager" as plain text. The client's logo image is not part
 * of this public excerpt.
 */
export function Logo({ size = 48 }: LogoProps) {
  return (
    <div className={styles.logo}>
      <div className={styles.text}>
        <strong className={styles.name} style={{ fontSize: size === 56 ? 20 : 16 }}>
          Pit's Burger
        </strong>
        <span className={styles.app}>Manager</span>
      </div>
    </div>
  );
}
