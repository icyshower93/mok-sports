import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// IMPORTANT: Vite root is "client", so place .env there
const envPath = path.join(__dirname, "..", "client", ".env");

// Generate build hash and time
const hash = process.env.REPL_ID || 
             process.env.VERCEL_GIT_COMMIT_SHA || 
             String(Math.floor(Date.now() / 1000));
const time = new Date().toISOString();

// Write environment variables
const envContent = `VITE_BUILD_HASH=${hash}\nVITE_BUILD_TIME=${time}\n`;
fs.writeFileSync(envPath, envContent);

console.log("✅ Wrote build env to", envPath);
console.log("📦 Build hash:", hash);
console.log("📅 Build time:", time);