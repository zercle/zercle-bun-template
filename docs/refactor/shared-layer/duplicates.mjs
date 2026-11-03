/**
 * Counts duplicated code blocks across the non-test sources.
 *
 * A "block" is a window of 6 consecutive non-trivial source lines (comments
 * and blank lines removed). Two blocks with the same text are duplication.
 * The last output line is the total; the rest lists the worst offenders.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const WINDOW = 6;

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git" || entry === ".kilo") continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, acc);
    else if (path.endsWith(".ts") && !path.endsWith(".test.ts")) acc.push(path);
  }
  return acc;
}

const blocks = new Map();
for (const file of walk(join(ROOT, "src"))) {
  const lines = readFileSync(file, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 && !line.startsWith("*") && !line.startsWith("//") && !line.startsWith("/*"),
    );
  for (let i = 0; i + WINDOW <= lines.length; i++) {
    const key = lines.slice(i, i + WINDOW).join("\n");
    const sites = blocks.get(key) ?? [];
    sites.push(`${relative(ROOT, file)}:${i + 1}`);
    blocks.set(key, sites);
  }
}

const dups = [...blocks.values()].filter((sites) => sites.length > 1);
dups.sort((a, b) => b.length - a.length);
for (const sites of dups.slice(0, 10)) {
  console.log(`x${sites.length}: ${sites.join(", ")}`);
}
console.log(`total duplicated ${WINDOW}-line blocks: ${dups.length}`);
