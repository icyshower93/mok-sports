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

// Map common error positions - adjust these based on your actual stack traces
console.log("Mapping common error positions...");
mapPos(1, 1);
mapPos(100, 1000);
mapPos(402, 152675);  // From the example