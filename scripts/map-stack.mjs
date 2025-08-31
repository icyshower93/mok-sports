import fs from "fs";
import { TraceMap, originalPositionFor } from "@jridgewell/trace-mapping";

const [, , mapFile, ...pairs] = process.argv;
if (!mapFile || pairs.length === 0) {
  console.error("Usage: node scripts/map-stack.mjs <path-to-map> <line:col> [line:col...]");
  process.exit(1);
}

const map = new TraceMap(JSON.parse(fs.readFileSync(mapFile, "utf8")));

for (const pair of pairs) {
  const [lineStr, colStr] = pair.split(":");
  const line = Number(lineStr);
  const column = Number(colStr);
  const pos = originalPositionFor(map, { line, column });
  console.log(`${pair} ->`, pos);
}