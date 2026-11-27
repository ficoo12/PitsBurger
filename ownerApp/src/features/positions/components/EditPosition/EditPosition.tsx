import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router";
import { Alert } from "../../../../components/ui/Alert/Alert";
import { ButtonLink } from "../../../../components/ui/Button/Button";
import { Spinner } from "../../../../components/ui/Spinner/Spinner";
import { toApiError } from "../../../../lib/apiClient";
import { useEditPosition } from "../../api/useEditPosition";
import { useGetPositions } from "../../api/useGetPositions";
import { PositionForm } from "../PositionForm/PositionForm";
import { fromPosition } from "../PositionForm/validation";
import styles from "./EditPosition.module.css";

const LIST_PATH = "/dashboard/positions";

/** The page to rename the position from the URL (`:id`) or change its colour. Saving goes back to the list. */
export function EditPosition() {
  const navigate = useNavigate();
  const id = Number(useParams().id);
  // The position comes from the list, which is usually cached already.
  const positions = useGetPositions();
  const edit = useEditPosition();
  const position = positions.data?.find((item) => item.id === id);

  // The position is checked first: a list that is already loaded stays in
  // use when a refresh in the background fails (isError is true then, too),
  // so the form and what was typed into it are not thrown away.
  let content: ReactNode;
  if (position) {
    content = (
      <PositionForm
        // A different position starts a fresh form.
        key={position.id}
        initialValues={fromPosition(position)}
        others={(positions.data ?? []).filter((item) => item.id !== position.id)}
        submitLabel="Save changes"
        pendingLabel="Saving …"
        errorTitle="Couldn't save the position"
        isPending={edit.isPending}
        error={edit.error}
        onEdit={edit.reset}
        onSubmit={(input) =>
          edit.mutate({ id: position.id, input }, { onSuccess: () => navigate(LIST_PATH) })
        }
      />
    );
  } else if (positions.data) {
    content = <Alert title="Position not found" detail="It may have been deleted." />;
  } else if (positions.isPending) {
    content = <Spinner label="Loading position" />;
  } else {
    content = (
      <Alert title="Couldn't load the position" detail={toApiError(positions.error).message} />
    );
  }

  return (
    <div className={styles.page}>
      <ButtonLink to={LIST_PATH} variant="secondary" className={styles.back}>
        <span aria-hidden="true">←</span> Back to positions
      </ButtonLink>
      <h1>Edit position</h1>
      {content}
    </div>
  );
}
