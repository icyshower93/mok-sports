// scripts/make-fresh-html.mjs
import fs from "fs";
import path from "path";

const dist = "dist/public";
const indexPath = path.join(dist, "index.html");
if (!fs.existsSync(indexPath)) {
  console.error("❌ index.html not found at", indexPath);
  process.exit(1);
}

const html = fs.readFileSync(indexPath, "utf8");
const m = html.match(/assets\/index-([A-Za-z0-9_-]+)\.js/);
if (!m) {
  console.error("❌ Could not find assets/index-*.js in index.html");
  process.exit(1);
}
const hash = m[1];
const bundle = `assets/index-${hash}.js`;
const freshName = `fresh-${hash}.html`;
const freshPath = path.join(dist, freshName);

fs.writeFileSync(freshPath, html, "utf8");

// Write a manifest so you can programmatically discover the latest fresh page
const manifest = {
  freshHtml: `/${freshName}`,
  bundle,
  createdAt: new Date().toISOString(),
};
fs.writeFileSync(path.join(dist, "fresh-manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

console.log("✅ Wrote:", freshPath);
console.log("✅ Manifest:", path.join(dist, "fresh-manifest.json"));
console.log("➡  Open this after deploy:", `https://mok-sports-draft-mokfantasysport.replit.app${manifest.freshHtml}`);