
import fs from 'fs';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';

const [, , mapFile, ...pairs] = process.argv;

if (!mapFile || pairs.length === 0) {
  console.error('Usage: node scripts/map-stack.mjs <path-to-map> <line:col> [line:col...]');
  process.exit(1);
}

try {
  const map = new TraceMap(JSON.parse(fs.readFileSync(mapFile, 'utf8')));
  
  console.log('📍 Source mapping results:');
  console.log('========================');
  
  for (const pair of pairs) {
    const [lineStr, colStr] = pair.split(':');
    const pos = originalPositionFor(map, { 
      line: Number(lineStr), 
      column: Number(colStr) 
    });
    
    console.log(`${pair} -> ${JSON.stringify(pos, null, 2)}`);
  }
} catch (error) {
  console.error('❌ Error mapping stack:', error.message);
  process.exit(1);
}

