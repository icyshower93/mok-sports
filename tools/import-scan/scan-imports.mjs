import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../../');
const SRC_DIR = path.join(projectRoot, 'client', 'src');

const exts = ['.ts','.tsx','.js','.jsx','.mjs','.mts','.cjs'];
const indexCandidates = exts.map(e => 'index'+e);

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

function* walk(dir) {
  const ents = fs.readdirSync(dir, {withFileTypes:true});
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      yield* walk(p);
    } else if (/\.(ts|tsx|js|jsx|mjs|mts|cjs)$/.test(e.name)) {
      yield p;
    }
  }
}

function resolveRelative(importer, spec) {
  // Resolve like Node would, checking file or directory w/ index
  let p = path.resolve(path.dirname(importer), spec);

  // If file exists as-is, keep; else try appending extensions
  if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;

  for (const e of exts) {
    if (fs.existsSync(p+e)) return p+e;
  }
  // If it's a directory, try index.*
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
    for (const idx of indexCandidates) {
      const cand = path.join(p, idx);
      if (fs.existsSync(cand)) return cand;
    }
  }
  return null;
}

function aliasToAbs(spec) {
  // Treat "@/x/y" as <SRC_DIR>/x/y
  const rel = spec.slice(2); // strip "@/"
  const abs = path.join(SRC_DIR, rel);
  if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;
  for (const e of exts) {
    if (fs.existsSync(abs+e)) return abs+e;
  }
  if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
    for (const idx of indexCandidates) {
      const cand = path.join(abs, idx);
      if (fs.existsSync(cand)) return cand;
    }
  }
  return null;
}

function toModuleKey(absPath) {
  // Create a canonical key like "features/auth/useAuth"
  let rel = path.relative(SRC_DIR, absPath).replace(/\\/g, '/');
  for (const e of exts) {
    if (rel.endsWith(e)) rel = rel.slice(0, -e.length);
  }
  if (rel.endsWith('/index')) rel = rel.slice(0, -('/index'.length));
  return rel;
}

const importRE = /^\s*import\s+(?:type\s+)?(?:.+?)\s+from\s+['"](.+?)['"]/mg;
const results = [];

for (const file of walk(SRC_DIR)) {
  const src = readFileSafe(file);
  if (!src) continue;
  let m;
  while ((m = importRE.exec(src)) !== null) {
    const spec = m[1];
    let kind = null, abs = null;

    if (spec.startsWith('@/')) {
      kind = 'alias';
      abs = aliasToAbs(spec);
    } else if (spec.startsWith('./') || spec.startsWith('../')) {
      kind = 'relative';
      abs = resolveRelative(file, spec);
    } else {
      continue; // package import
    }

    if (!abs) continue;
    const key = toModuleKey(abs);
    results.push({ importer: path.relative(projectRoot, file).replace(/\\/g,'/'), spec, kind, abs, key });
  }
}

fs.writeFileSync(path.join(__dirname, 'imports.json'), JSON.stringify(results, null, 2));
const byKey = new Map();
for (const r of results) {
  if (!byKey.has(r.key)) byKey.set(r.key, []);
  byKey.get(r.key).push(r);
}

const conflicts = [];
for (const [key, arr] of byKey.entries()) {
  const kinds = new Set(arr.map(a => a.kind));
  if (kinds.has('alias') && kinds.has('relative')) {
    conflicts.push({
      module_key: key,
      alias_importers: [...new Set(arr.filter(a=>a.kind==='alias').map(a=>a.importer))].sort(),
      relative_importers: [...new Set(arr.filter(a=>a.kind==='relative').map(a=>a.importer))].sort()
    });
  }
}

fs.writeFileSync(path.join(__dirname, 'conflicts.json'), JSON.stringify(conflicts, null, 2));
console.log('=== Mixed alias vs relative imports (conflicts) ===');
if (conflicts.length === 0) {
  console.log('None 🎉');
} else {
  for (const c of conflicts) {
    console.log(`• ${c.module_key}`);
    console.log(`  alias in:    ${c.alias_importers.length}`);
    console.log(`  relative in: ${c.relative_importers.length}`);
  }
  console.log(`\nTotal conflicts: ${conflicts.length}`);
}
