import { useState } from "react";
import { Link } from "react-router";
import { Alert } from "../../../../components/ui/Alert/Alert";
import { ColourChip } from "../../../../components/ui/ColourChip/ColourChip";
import { Spinner } from "../../../../components/ui/Spinner/Spinner";
import { toApiError } from "../../../../lib/apiClient";
import { PALETTE_LABELS, SHADES, paletteVar } from "../../../../lib/palette";
import { useGetPositions } from "../../api/useGetPositions";
import type { Position } from "../../types";
import { DeletePosition } from "../DeletePosition/DeletePosition";
import table from "../../../../components/ui/Table/Table.module.css";

const editPath = (position: Position) => `/dashboard/positions/${position.id}/edit`;

/**
 * The owner's positions as a table, each with its colour, and a link to
 * create another one in the last row.
 */
export function PositionList() {
  const positions = useGetPositions();
  /** The position whose delete window is open. */
  const [deleting, setDeleting] = useState<Position | null>(null);

  // Only without a list: one that is already loaded stays on screen when a
  // refresh in the background fails (isError is true then, too).
  if (positions.data === undefined) {
    if (positions.isPending) return <Spinner label="Loading positions" />;
    return (
      <Alert title="Couldn't load positions" detail={toApiError(positions.error).message} />
    );
  }

  return (
    <>
      <div className={table.scroll}>
        <table className={table.table}>
          <thead>
            <tr>
              <th scope="col" colSpan={2}>
                Position
              </th>
            </tr>
          </thead>
          <tbody>
            {positions.data.map((position) => (
              <tr key={position.id}>
                <th scope="row" className={table.name}>
                  <span className={table.withChip}>
                    <ColourChip
                      colours={SHADES.map((shade) => paletteVar(position.colour, shade))}
                      label={PALETTE_LABELS[position.colour]}
                    />
                    {position.name}
                  </span>
                </th>
                <td className={table.actions}>
                  <Link
                    to={editPath(position)}
                    className={table.action}
                    aria-label={`Edit ${position.name}`}
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    className={`${table.action} ${table.danger}`}
                    aria-label={`Delete ${position.name}`}
                    onClick={() => setDeleting(position)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {/* Always the last row, under the positions that already exist. */}
            <tr className={table.emptyRow}>
              <td colSpan={2}>
                <Link to="/dashboard/positions/new" className={table.add}>
                  {positions.data.length === 0 ? "+ Add first position" : "+ Create new position"}
                </Link>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {deleting && <DeletePosition position={deleting} onClose={() => setDeleting(null)} />}
    </>
  );
}
