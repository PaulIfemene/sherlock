// Loads the system prompts from the .md files next to this module. netlify.toml bundles them via
// `included_files`; the candidates cover Vite dev, Vitest, scripts and the deployed function.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const cache = new Map<string, string>()

function candidates(name: string): string[] {
  const list = [join(process.cwd(), 'engine', 'prompts', name)]
  try {
    list.push(join(dirname(fileURLToPath(import.meta.url)), name))
  } catch {
    // import.meta.url is unavailable in some bundles; the cwd path covers them.
  }
  if (process.env.LAMBDA_TASK_ROOT) list.push(join(process.env.LAMBDA_TASK_ROOT, 'engine', 'prompts', name))
  return list
}

export function loadPrompt(name: 'assess.system.md' | 'extract.system.md'): string {
  const hit = cache.get(name)
  if (hit) return hit
  for (const path of candidates(name)) {
    try {
      const text = readFileSync(path, 'utf8')
      cache.set(name, text)
      return text
    } catch {
      // try the next location
    }
  }
  throw new Error(`prompt not found: ${name}`)
}
