import { PositionList } from "../features/positions";
import styles from "./PositionsPage.module.css";

export function PositionsPage() {
  return (
    <div className={styles.page}>
      <h1>Positions</h1>
      <PositionList />
    </div>
  );
}
