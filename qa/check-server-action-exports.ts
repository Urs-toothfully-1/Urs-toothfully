/**
 * Guards against a footgun that passes the build and crashes on click.
 *
 *   TS_NODE_PROJECT=qa/tsconfig.qa.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register qa/check-server-action-exports.ts
 *
 * A "use server" module may only export async functions. A plain
 * `export const FOO = [...]` in one compiles fine, but any client component
 * importing it receives `undefined` — so `FOO[0]` or `FOO.map()` throws at the
 * moment a user opens the form. Option lists belong in a plain module
 * (see lib/template-options.ts), imported by both the action and the form.
 */
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

const ROOTS = ["actions", "app", "components", "server", "lib"]
const VALUE_EXPORT = /^export\s+(const|let|var|class|enum|function\*?)\s+(\w+)/gm

function walk(dir: string): string[] {
  let out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out = out.concat(walk(full))
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full)
  }
  return out
}

const offenders: string[] = []

for (const root of ROOTS) {
  let files: string[] = []
  try {
    files = walk(root)
  } catch {
    continue // root not present in this checkout
  }

  for (const file of files) {
    const source = readFileSync(file, "utf8")
    // Only a directive on the first lines makes the whole module a server module.
    if (!/^\s*(["'])use server\1/m.test(source.slice(0, 200))) continue

    for (const match of source.matchAll(VALUE_EXPORT)) {
      const [, kind, name] = match
      // `export async function` is the one legal shape; the regex already skips
      // it by requiring the keyword immediately after `export`.
      if (kind === "function") {
        offenders.push(`${file}: export function ${name} (must be async)`)
      } else {
        offenders.push(`${file}: export ${kind} ${name}`)
      }
    }
  }
}

if (offenders.length) {
  console.error('Non-async exports found in "use server" modules:\n')
  for (const o of offenders) console.error(`  ${o}`)
  console.error("\nMove values into a plain module and import them in both places.")
  process.exitCode = 1
} else {
  console.log('server-action exports: all "use server" modules export only async functions')
}
