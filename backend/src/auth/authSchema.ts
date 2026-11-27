import { z } from "zod";

const optionalName = z.string().trim().min(1).max(100).optional();

// Input of `npm run create-owner` (src/db/createOwner.ts).
// z.object strips unknown keys, so nothing but these fields reaches the insert.
export const createOwnerSchema = z.object({
  // Normalize first, then validate the normalized value.
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  // bcrypt only uses the first 72 bytes; the max keeps huge bodies out of the hasher.
  password: z.string().min(10).max(128),
  firstName: optionalName,
  lastName: optionalName,
  username: z.string().trim().min(3).max(50).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: z.string().min(1).max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;

export type CreateOwnerInput = z.input<typeof createOwnerSchema>;
