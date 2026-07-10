#!/usr/bin/env node
// Bump the Mint Stylus version in package.json. Run BEFORE every shared/release
// build so each build carries a distinct version number.
//   node scripts/bump-version.mjs           -> patch  (4.7.0 -> 4.7.1)
//   node scripts/bump-version.mjs minor      -> minor  (4.7.1 -> 4.8.0)
//   node scripts/bump-version.mjs major      -> major  (4.8.0 -> 5.0.0)
//   node scripts/bump-version.mjs 4.9.2      -> set exactly
import { readFileSync, writeFileSync } from 'node:fs'
const kind = (process.argv[2] || 'patch').trim()
const raw = readFileSync('package.json', 'utf8')
const cur = JSON.parse(raw).version
let next
if (/^\d+\.\d+\.\d+$/.test(kind)) {
  next = kind
} else {
  const [ma, mi, pa] = cur.split('.').map(Number)
  next = kind === 'major' ? `${ma + 1}.0.0` : kind === 'minor' ? `${ma}.${mi + 1}.0` : `${ma}.${mi}.${pa + 1}`
}
writeFileSync('package.json', raw.replace(`"version": "${cur}"`, `"version": "${next}"`))
console.log(`version: ${cur} -> ${next}`)
