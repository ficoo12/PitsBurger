import { ScheduleList } from "../features/schedules";
import styles from "./SchedulePage.module.css";

export function SchedulePage() {
  return (
    <div className={styles.page}>
      <h1>Schedule</h1>
      <ScheduleList />
    </div>
  );
}
