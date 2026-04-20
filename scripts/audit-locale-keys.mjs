import { readFileSync } from 'fs'

const pages = [
  'pages/ai-datalake/catalog.vue',
  'pages/ai-datalake/volume-catalog.vue',
  'pages/filesystem/dirs.vue',
  'components/filesystem/create-dir-dialog.vue',
  'components/filesystem/edit-dir-dialog.vue',
]
const enUs = JSON.parse(readFileSync('i18n/locales/en-US.json', 'utf8'))
const zhCn = JSON.parse(readFileSync('i18n/locales/zh-CN.json', 'utf8'))
const re = /\bt\(\s*["'`]([^"'`]+)["'`]/g

let missingEn = [],
  missingZh = [],
  allKeys = new Set()
for (const f of pages) {
  const src = readFileSync(f, 'utf8')
  for (const m of src.matchAll(re)) {
    const key = m[1]
    allKeys.add(key)
    if (!(key in enUs)) missingEn.push(`  ${key}  [${f}]`)
    if (!(key in zhCn)) missingZh.push(`  ${key}  [${f}]`)
  }
}
console.log('MISSING en-US:', missingEn.length ? '\n' + missingEn.join('\n') : 'none')
console.log('MISSING zh-CN:', missingZh.length ? '\n' + missingZh.join('\n') : 'none')
console.log('Total keys checked:', allKeys.size)
