import { execFile } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { backendDir, backendEnv } from "./env.js";

const execFileAsync = promisify(execFile);

export type OwnerCredentials = { email: string; password: string };

/**
 * Creates a new owner through the backend's own create-owner script (there is
 * no sign up). Every test gets its own owner, so tests never share data and
 * can run in parallel.
 */
export async function createOwner(): Promise<OwnerCredentials> {
  const email = `owner-${randomUUID()}@e2e.test`;
  const password = randomBytes(12).toString("base64url");

  await execFileAsync(
    process.execPath,
    // "--opt=value": a random password can start with "-", which parseArgs
    // would otherwise read as an option.
    ["dist/db/createOwner.js", `--email=${email}`, `--password=${password}`],
    { cwd: backendDir, env: { ...process.env, ...backendEnv } }
  );

  return { email, password };
}
