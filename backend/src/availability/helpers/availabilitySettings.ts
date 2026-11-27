import { eq } from "drizzle-orm";
import { db } from "../../db/dbcon.js";
import { availabilitySettings } from "../../db/schema.js";
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** What the API returns for the settings (owner_id is always the caller). */
export type AvailabilitySettings = {
  opensWeekday: number;
  opensTime: string;
  closesWeekday: number;
  closesTime: string;
  maxSaves: number;
};

export const publicSettingsColumns = {
  opensWeekday: availabilitySettings.opensWeekday,
  opensTime: availabilitySettings.opensTime,
  closesWeekday: availabilitySettings.closesWeekday,
  closesTime: availabilitySettings.closesTime,
  maxSaves: availabilitySettings.maxSaves,
};

// An owner who never saved the settings has no row and gets these: Friday
// 00:00 to Sunday 23:59 (the closing minute is included), 3 saves.
export const DEFAULT_AVAILABILITY_SETTINGS: AvailabilitySettings = {
  opensWeekday: 5,
  opensTime: "00:00",
  closesWeekday: 7,
  closesTime: "23:59",
  maxSaves: 3,
};

/** Postgres returns times as HH:MM:SS; the API speaks HH:MM. */
export function formatSettings(
  row: AvailabilitySettings
): AvailabilitySettings {
  return {
    ...row,
    opensTime: row.opensTime.slice(0, 5),
    closesTime: row.closesTime.slice(0, 5),
  };
}

/** The owner's settings, or the defaults when they never saved any. */
export async function findAvailabilitySettings(
  ownerId: number,
  executor: typeof db | Tx = db
): Promise<AvailabilitySettings> {
  const [row] = await executor
    .select(publicSettingsColumns)
    .from(availabilitySettings)
    .where(eq(availabilitySettings.ownerId, ownerId));

  return row ? formatSettings(row) : DEFAULT_AVAILABILITY_SETTINGS;
}
