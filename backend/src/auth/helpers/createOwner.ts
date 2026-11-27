import bcrypt from "bcrypt";
import { db } from "../../db/dbcon.js";
import { appUser } from "../../db/schema.js";
import { createOwnerSchema, type CreateOwnerInput } from "../authSchema.js";
import { publicUserColumns, type PublicUser } from "./publicUserColumns.js";

const BCRYPT_COST = 12;

/**
 * Creates an owner account that can log in at once with this email and
 * password. Used by `npm run create-owner` (src/db/createOwner.ts).
 *
 * Throws a ZodError for invalid input, and the Postgres unique violation
 * (see isUniqueViolation) when the email or username is taken.
 */
export async function createOwner(input: CreateOwnerInput): Promise<PublicUser> {
  const { password, ...profile } = createOwnerSchema.parse(input);
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  const [owner] = await db
    .insert(appUser)
    .values({ ...profile, passwordHash, role: "owner" })
    .returning(publicUserColumns);
  return owner;
}
