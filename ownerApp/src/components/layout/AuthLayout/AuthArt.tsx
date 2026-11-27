import styles from "./AuthArt.module.css";

// Decorative slice of a weekly plan in the Excel colours (design system: ManagerLogin brand panel).
// Each row: the name-cell colour, then Monday–Sunday.
type Cell = "svc" | "svc2" | "kit" | "kit2" | "drv" | "drv2" | "off";

const DAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

const ROWS: [Cell, ...Cell[]][] = [
  ["svc", "off", "off", "off", "off", "svc2", "svc2", "off"],
  ["svc", "off", "off", "off", "off", "svc2", "svc2", "svc"],
  ["svc", "svc2", "svc2", "off", "off", "off", "off", "off"],
  ["svc", "off", "off", "svc", "svc", "off", "svc", "off"],
  ["svc", "svc", "svc", "off", "off", "svc", "off", "svc2"],
  ["kit", "off", "off", "kit2", "kit2", "kit2", "kit2", "kit2"],
  ["kit", "kit2", "kit2", "off", "off", "off", "off", "off"],
  ["kit", "off", "off", "off", "kit", "off", "kit2", "off"],
  ["kit", "off", "off", "kit", "off", "off", "off", "kit"],
  ["drv", "drv", "off", "drv", "off", "off", "off", "off"],
  ["drv", "off", "drv", "off", "drv", "off", "off", "drv2"],
  ["drv", "drv", "drv", "off", "drv", "drv", "off", "off"],
];

const DAY_X = 176;
const DAY_STEP = 96;
const ROW_Y = 64;
const ROW_STEP = 32;

/** The right half of AuthLayout. Hidden below 960px. */
export function AuthArt() {
  return (
    <aside className={styles.art} aria-hidden="true">
      <svg viewBox="0 0 848 448">
        {DAYS.map((day, i) => (
          <g key={day}>
            <rect
              className={styles.header}
              x={DAY_X + i * DAY_STEP}
              y={0.5}
              width={96}
              height={56}
            />
            <text
              className={styles.day}
              x={DAY_X + i * DAY_STEP + 48}
              y={32}
              textAnchor="middle"
            >
              {day}
            </text>
          </g>
        ))}
        <rect
          className={styles.red}
          x={0}
          y={ROW_Y}
          width={72}
          height={ROWS.length * ROW_STEP}
        />
        {ROWS.map(([name, ...days], row) => {
          const y = ROW_Y + row * ROW_STEP;
          return (
            <g key={row}>
              <rect
                className={styles[name]}
                x={80}
                y={y}
                width={88}
                height={30}
              />
              {days.map((cell, i) => (
                <rect
                  key={i}
                  className={styles[cell]}
                  x={DAY_X + i * DAY_STEP}
                  y={y}
                  width={94}
                  height={30}
                />
              ))}
            </g>
          );
        })}
      </svg>
    </aside>
  );
}
