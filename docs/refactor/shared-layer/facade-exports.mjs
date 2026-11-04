/**
 * Lists the public names the published facade `src/index.ts` re-exports.
 *
 * The facade is the only outward-facing surface of the service, so the sorted
 * name list is the behavior anchor for "the published contract did not change".
 */
import { readFileSync } from "node:fs";

const source = readFileSync("src/index.ts", "utf8");
const names = new Set();

for (const match of source.matchAll(/export\s*\{([^}]*)\}/g)) {
  for (const part of match[1].split(",")) {
    const trimmed = part.trim();
    if (trimmed.length === 0) continue;
    const asMatch = /\bas\s+([A-Za-z_$][\w$]*)$/.exec(trimmed);
    names.add(asMatch ? asMatch[1] : trimmed);
  }
}
for (const match of source.matchAll(/export\s+(?:const|type|interface|class|function)\s+([A-Za-z_$][\w$]*)/g)) {
  names.add(match[1]);
}

console.log([...names].sort().join("\n"));
console.log(`\ntotal exported names: ${names.size}`);
