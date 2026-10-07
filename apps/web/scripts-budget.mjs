import { readFileSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
const manifest = JSON.parse(readFileSync(new URL('./dist/.vite/manifest.json', import.meta.url), 'utf8'))
const entry = Object.values(manifest).find(value => value.isEntry)
const seen = new Set()
function size(value) {
  if (seen.has(value.file)) return 0
  seen.add(value.file)
  return gzipSync(readFileSync(new URL(`./dist/${value.file}`, import.meta.url))).length + (value.imports ?? []).reduce((sum, key) => sum + size(manifest[key]), 0)
}
const initialBytes = size(entry)
if (initialBytes > 200 * 1024) throw new Error(`Initial JavaScript is ${initialBytes} bytes gzip; limit is 204800.`)
for (const [name, limit] of [['food-handover-480.webp', 150000], ['food-handover-900.webp', 150000], ['food-handover-1448.webp', 300000]]) {
  const bytes = statSync(new URL(`./public/images/${name}`, import.meta.url)).size
  if (bytes > limit) throw new Error(`${name} exceeds ${limit} bytes.`)
}
console.log(`Initial JavaScript: ${initialBytes} bytes gzip (budget: 204800). Responsive hero budgets passed.`)
