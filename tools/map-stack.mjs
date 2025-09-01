import fs from "fs";
import path from "path";
import { TraceMap, originalPositionFor } from "@jridgewell/trace-mapping";

const dist = path.resolve("dist/public/assets");
const js = fs.readdirSync(dist).find(f => /^index-.*\.js$/.test(f));
const map = new TraceMap(fs.readFileSync(path.join(dist, js + ".map"), "utf8"));

function mapPos(line, column) {
  const pos = originalPositionFor(map, { line, column });
  console.log(`${js}:${line}:${column} → ${pos.source}:${pos.line}:${pos.column}`);
}

// Map production error positions - update these based on latest logs
console.log("Mapping production error positions...");
console.log("📦 Current build bundles:");
console.log("  main-sMdw1EJ1.js   - 16.55 kB");
console.log("  App-xJFImDNB.js    - 156.90 kB");
console.log("  index-BDJrt2Wb.js  - 144.57 kB");
console.log();

// Previous TDZ error was fixed by removing module-level cacheManager export
// mapPos(31, 1793);  // main-sMdw1EJ1.js:31:1793 - FIXED: TDZ in cache-manager.ts