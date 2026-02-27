import { execSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

const dbPath = process.env.TIMECODE_DB_PATH ?? join(homedir(), ".config", "timecode", "timecode.db");

execSync("npx prisma db push", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: `file:${dbPath}` }
});
