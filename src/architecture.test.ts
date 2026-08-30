/**
 * Executable dependency gates for the clean-architecture layering.
 *
 * Each rule scans the import specifiers of every non-test source file under
 * `src/` and fails with the violated rule's rationale. Mirrors the Go
 * template's `internal/architecture_test.go` and the dependency rule of the
 * clean-architecture reference:
 *
 *   - dependencies point inward: driving adapters -> application port ->
 *     outbound ports + domain; the domain depends on nothing
 *   - the wire contract is a dependency-free leaf, published outward only
 *     through the `src/index.ts` facade
 *   - platform code stays feature-agnostic
 *
 * Test files are exempt (they wire fakes across layers by design), as is
 * `src/index.ts` itself (the facade's job is importing internals).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, posix, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)));

/** A resolved import: either a src-relative POSIX path (no extension) or a bare package specifier. */
interface Imp {
  src?: string;
  bare?: string;
}

interface Rule {
  name: string;
  why: string;
  applies: (rel: string) => boolean;
  denied: (rel: string, imp: Imp) => boolean;
}

const segments = (rel: string): string[] => (rel === "" ? [] : rel.split("/"));

/** Feature name for a `features/<name>/...` file, or undefined. */
function featureOf(rel: string): string | undefined {
  const segs = segments(rel);
  return segs[0] === "features" && segs.length >= 2 ? segs[1] : undefined;
}

/** True when `target` (src-relative, no extension) is inside (or equals) `dir`. */
const within = (target: string, dir: string): boolean =>
  target === dir || target.startsWith(`${dir}/`);

/** Third-party packages the wire contract may use (zod powers its runtime schemas). */
const CONTRACT_BARE_ALLOW = new Set(["zod"]);

const rules: Rule[] = [
  {
    name: "published-facade-is-outward-only",
    why: "internal code must not import the src/index.ts facade; depend on the feature contract modules directly",
    applies: () => true,
    denied: (_rel, imp) => imp.src === "index",
  },
  {
    name: "domain-is-innermost",
    why: "the domain may depend on nothing — no src imports, no third-party packages",
    applies: (rel) => {
      const segs = segments(rel);
      return segs[0] === "features" && segs[2] === "domain";
    },
    denied: (rel, imp) => {
      const f = featureOf(rel);
      if (imp.bare !== undefined) return true;
      return imp.src !== undefined && !within(imp.src, `features/${f}/domain`);
    },
  },
  {
    name: "contract-is-leaf",
    why: "the wire contract must stay dependency-free (zod only) so the published facade drags in nothing",
    applies: (rel) => {
      const segs = segments(rel);
      return segs[0] === "features" && segs[2] === "contract";
    },
    denied: (rel, imp) => {
      const f = featureOf(rel);
      if (imp.bare !== undefined) return !CONTRACT_BARE_ALLOW.has(imp.bare);
      return imp.src !== undefined && !within(imp.src, `features/${f}/contract`);
    },
  },
  {
    name: "port-depends-only-on-domain",
    why: "outbound ports may reference only their own feature's domain (and sibling port modules)",
    applies: (rel) => {
      const segs = segments(rel);
      return segs[0] === "features" && segs[2] === "port";
    },
    denied: (rel, imp) => {
      const f = featureOf(rel);
      if (imp.bare !== undefined) return true;
      if (imp.src === undefined) return false;
      const fdir = `features/${f}`;
      return !(within(imp.src, `${fdir}/domain`) || within(imp.src, `${fdir}/port`));
    },
  },
  {
    name: "application-depends-on-domain-port-contract",
    why: "use cases orchestrate their own feature's domain, ports, wire contract, and sibling application modules, nothing else",
    applies: (rel) => {
      const segs = segments(rel);
      return segs[0] === "features" && segs[2] === "application";
    },
    denied: (rel, imp) => {
      const f = featureOf(rel);
      if (imp.bare !== undefined) return true;
      if (imp.src === undefined) return false;
      const fdir = `features/${f}`;
      const allowed = ["domain", "port", "contract", "application"] as const;
      return !allowed.some((layer) => within(imp.src as string, `${fdir}/${layer}`));
    },
  },
  {
    name: "driven-adapters-ignore-application",
    why: "adapter/out satisfies ports structurally and must not know about the application layer or driving adapters",
    applies: (rel) => {
      const segs = segments(rel);
      return segs[0] === "features" && segs[2] === "adapter" && segs[3] === "out";
    },
    denied: (rel, imp) => {
      const f = featureOf(rel);
      if (imp.src === undefined) return false;
      return (
        within(imp.src, `features/${f}/application`) || within(imp.src, `features/${f}/adapter/in`)
      );
    },
  },
  {
    name: "driving-adapters-ignore-ports-and-driven-adapters",
    why: "adapter/in talks to the application port only, never to outbound ports or driven adapters",
    applies: (rel) => {
      const segs = segments(rel);
      return segs[0] === "features" && segs[2] === "adapter" && segs[3] === "in";
    },
    denied: (rel, imp) => {
      const f = featureOf(rel);
      if (imp.src === undefined) return false;
      return within(imp.src, `features/${f}/port`) || within(imp.src, `features/${f}/adapter/out`);
    },
  },
  {
    name: "platform-ignores-features",
    why: "cross-cutting platform code must stay feature-agnostic; features depend on platform, never the reverse",
    applies: (rel) => rel === "platform" || rel.startsWith("platform/"),
    denied: (_rel, imp) => imp.src?.startsWith("features/") === true,
  },
];

/** Strip comments so doc-comment import examples cannot trip the rules. */
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

/** Extract every import specifier from a source string. */
function importSpecifiers(code: string): string[] {
  const specs: string[] = [];
  const patterns = [
    /(?:^|[\s;}])(?:import|export)\b[^;'"()]*?\bfrom\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /(?:^|[\s;])import\s*["']([^"']+)["']/g,
  ];
  for (const re of patterns) {
    for (const m of code.matchAll(re)) {
      specs.push(m[1] as string);
    }
  }
  return specs;
}

/** Resolve a specifier to a src-relative POSIX path (no extension), or undefined for bare specifiers. */
function toSrcRel(spec: string, fileRel: string): Imp {
  if (!spec.startsWith(".")) {
    return { bare: spec };
  }
  const joined = posix.normalize(posix.join(posix.dirname(fileRel), spec));
  return { src: joined.replace(/\.ts$/, "") };
}

/** Walk src/ for lintable (non-test, non-facade) source files, src-relative. */
function sourceFiles(): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(SRC_ROOT, { recursive: true })) {
    const rel = relative(SRC_ROOT, join(SRC_ROOT, entry as string)).replaceAll("\\", "/");
    if (!rel.endsWith(".ts") || rel.endsWith(".test.ts") || rel === "index.ts") {
      continue;
    }
    files.push(rel);
  }
  return files.sort();
}

describe("architecture (clean-architecture dependency rules)", () => {
  it("every source file respects the layering rules", () => {
    const violations: string[] = [];
    const files = sourceFiles();
    let totalImports = 0;

    for (const file of files) {
      const code = stripComments(readFileSync(join(SRC_ROOT, file), "utf8"));
      const rel = posix.dirname(file);
      for (const spec of importSpecifiers(code)) {
        totalImports += 1;
        const imp = toSrcRel(spec, file);
        for (const rule of rules) {
          if (rule.applies(rel) && rule.denied(rel, imp)) {
            violations.push(`${file}: violates ${rule.name}: imports "${spec}" (${rule.why})`);
          }
        }
      }
    }

    // Sensor sanity: the gate must never pass vacuously. The walk must see
    // the real source tree and actually extract imports from it.
    expect(files.length).toBeGreaterThan(25);
    expect(totalImports).toBeGreaterThan(40);
    expect(violations).toEqual([]);
  });
});
