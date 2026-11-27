import { appUser } from "../../db/schema.js";

// The only user columns that may leave the server. Never return a full row.
export const publicUserColumns = {
  id: appUser.id,
  email: appUser.email,
  firstName: appUser.firstName,
  lastName: appUser.lastName,
  username: appUser.username,
  role: appUser.role,
  avatarUrl: appUser.avatarUrl,
  createdAt: appUser.createdAt,
};

export type PublicUser = Pick<
  typeof appUser.$inferSelect,
  keyof typeof publicUserColumns
>;
