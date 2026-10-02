import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const REVISION = '7455efae41b330c265e7cd4b78dfa848e7ce5ebd'
export const SOURCE = `https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/${REVISION}`
export const CACHE = resolve(ROOT, '.cache/exercises', REVISION)

export async function download(path, destination) {
  if (!/^(data|images|videos)\/[\w.-]+$/.test(path) && !['LICENSE', 'NOTICE.md'].includes(path)) {
    throw new Error(`Unexpected source path: ${path}`)
  }
  try { return await readFile(destination) } catch { /* Not cached yet. */ }
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(`${SOURCE}/${path}`, { signal: AbortSignal.timeout(60000) })
      if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`)
      const bytes = Buffer.from(await response.arrayBuffer())
      await mkdir(dirname(destination), { recursive: true })
      const temporary = `${destination}.partial`
      await writeFile(temporary, bytes)
      await rename(temporary, destination)
      return bytes
    } catch (error) {
      if (attempt === 3) throw error
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
    }
  }
}

export async function sourceRecords() {
  const bytes = await download('data/exercises.json', resolve(CACHE, 'exercises.json'))
  const records = JSON.parse(bytes.toString('utf8'))
  const ids = new Set()
  if (!Array.isArray(records) || records.length !== 1324) throw new Error('Expected 1,324 exercises')
  for (const record of records) {
    if (!/^\d+$/.test(record.id) || ids.has(record.id) || !record.name || !record.target ||
      !record.equipment || !record.instruction_steps?.es?.length || !record.attribution ||
      !/^images\/[\w.-]+\.jpg$/.test(record.image) || !/^videos\/[\w.-]+\.gif$/.test(record.gif_url)) {
      throw new Error(`Invalid record: ${record.id}`)
    }
    ids.add(record.id)
  }
  return records
}

export async function parallel(items, concurrency, worker) {
  let index = 0
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (index < items.length) await worker(items[index++])
  }))
}
