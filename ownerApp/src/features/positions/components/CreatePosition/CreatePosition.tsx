import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { Alert } from "../../../../components/ui/Alert/Alert";
import { ButtonLink } from "../../../../components/ui/Button/Button";
import { Spinner } from "../../../../components/ui/Spinner/Spinner";
import { toApiError } from "../../../../lib/apiClient";
import { PALETTE, nextFree } from "../../../../lib/palette";
import { useCreatePosition } from "../../api/useCreatePosition";
import { useGetPositions } from "../../api/useGetPositions";
import { PositionForm } from "../PositionForm/PositionForm";
import { emptyValues } from "../PositionForm/validation";
import styles from "./CreatePosition.module.css";

const LIST_PATH = "/dashboard/positions";

/**
 * The page for a new position, with the next free colour picked. Goes back
 * to the list once the position is created.
 */
export function CreatePosition() {
  const navigate = useNavigate();
  // The colours the other positions have, usually cached from the list already.
  const positions = useGetPositions();
  const create = useCreatePosition();

  let content: ReactNode;
  if (positions.data) {
    content = (
      <PositionForm
        initialValues={emptyValues(
          nextFree(
            PALETTE,
            positions.data.map((position) => position.colour),
          ),
        )}
        others={positions.data}
        submitLabel="Create position"
        pendingLabel="Creating …"
        errorTitle="Couldn't create the position"
        isPending={create.isPending}
        error={create.error}
        onEdit={create.reset}
        onSubmit={(input) => create.mutate(input, { onSuccess: () => navigate(LIST_PATH) })}
      />
    );
  } else if (positions.isPending) {
    content = <Spinner label="Loading positions" />;
  } else {
    content = (
      <Alert title="Couldn't load positions" detail={toApiError(positions.error).message} />
    );
  }

  return (
    <div className={styles.page}>
      <ButtonLink to={LIST_PATH} variant="secondary" className={styles.back}>
        <span aria-hidden="true">←</span> Back to positions
      </ButtonLink>
      <h1>New position</h1>
      {content}
    </div>
  );
}
