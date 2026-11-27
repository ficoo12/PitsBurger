// Creates an owner account (there is no sign up page).
//
//   npm run create-owner -- --email ana@example.com --first-name Ana --last-name Horvat
//
// Options: --email (required), --first-name, --last-name, --username,
// --password. Without --password a random one is generated and printed once.
// Uses DATABASE_URL from .env. In production, after `npm run build`:
//   node dist/db/createOwner.js --email …
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { ZodError, z } from "zod";
import { createOwner } from "../auth/helpers/createOwner.js";
import { isUniqueViolation } from "../auth/helpers/isUniqueViolation.js";
import { db } from "./dbcon.js";

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      password: { type: "string" },
      "first-name": { type: "string" },
      "last-name": { type: "string" },
      username: { type: "string" },
    },
  });

  if (!values.email) {
    console.error(
      "Usage: npm run create-owner -- --email <email> [--first-name <name>] [--last-name <name>] [--username <name>] [--password <password>]"
    );
    return 1;
  }

  const generated = values.password === undefined;
  const password = values.password ?? randomBytes(12).toString("base64url");

  try {
    const owner = await createOwner({
      email: values.email,
      password,
      firstName: values["first-name"],
      lastName: values["last-name"],
      username: values.username,
    });
    console.log(`Created owner #${owner.id}: ${owner.email}`);
    if (generated) {
      console.log(`Password: ${password}`);
      console.log("It is shown only now. Send it to the owner securely.");
    }
    return 0;
  } catch (err) {
    if (err instanceof ZodError) {
      console.error("Invalid input:", z.flattenError(err).fieldErrors);
      return 1;
    }
    if (isUniqueViolation(err)) {
      console.error("An account with this email or username already exists.");
      return 1;
    }
    throw err;
  }
}

try {
  process.exitCode = await main();
} finally {
  await db.$client.end();
}
