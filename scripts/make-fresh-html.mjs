import fs from "fs";
import path from "path";

const dist = "dist/public";
const indexPath = path.join(dist, "index.html");
if (!fs.existsSync(indexPath)) {
  console.error("index.html not found at", indexPath);
  process.exit(1);
}
const html = fs.readFileSync(indexPath, "utf8");
// Extract the hashed bundle name
const m = html.match(/assets\/index-([A-Za-z0-9_-]+)\.js/);
const hash = m?.[1];
const freshName = hash ? `fresh-${hash}.html` : `fresh-${Date.now()}.html`;
const freshPath = path.join(dist, freshName);
fs.writeFileSync(freshPath, html);
console.log("Wrote", freshPath);