// scripts/inject-build-env.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, "..", "client", ".env");

// Prefer a stable unique ID from host CI if present; fallback to timestamp
const hash =
  process.env.REPL_ID ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  String(Math.floor(Date.now() / 1000));

const time = new Date().toISOString();

const contents = `VITE_BUILD_HASH=${hash}
VITE_BUILD_TIME=${time}
`;

fs.writeFileSync(envPath, contents, "utf8");
console.log(`[inject-build-env] wrote ${envPath}`);