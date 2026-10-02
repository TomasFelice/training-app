import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { ROOT, REVISION, SOURCE, sourceRecords, download, parallel } from './catalog-source.js'

const records = await sourceRecords()
const destination = resolve(ROOT, 'public/catalog')
await mkdir(destination, { recursive: true })
const normalized = records.map((record) => ({
  catalogId: record.id,
  name: record.name,
  equipment: record.equipment,
  target: record.target,
  bodyPart: record.body_part,
  secondaryMuscles: record.secondary_muscles,
  instructionSteps: record.instruction_steps.es,
  image: `/catalog/${record.image}`,
  video: `/catalog/${record.gif_url.replace(/\.gif$/, '.mp4')}`,
  attribution: record.attribution,
}))
const json = JSON.stringify(normalized)
await writeFile(resolve(destination, 'exercises.json'), json)
await writeFile(resolve(destination, 'source.json'), JSON.stringify({
  repository: 'https://github.com/hasaneyldrm/exercises-dataset', revision: REVISION,
  source: SOURCE, count: records.length, sha256: createHash('sha256').update(json).digest('hex'),
  dataLicense: 'MIT', mediaOwner: 'Gym visual', resolution: [180, 180],
}, null, 2) + '\n')
for (const name of ['LICENSE', 'NOTICE.md']) {
  await download(name, resolve(destination, name))
}
if (!process.argv.includes('--data-only')) {
  let count = 0
  await parallel(records, 10, async (record) => {
    await download(record.image, resolve(destination, record.image))
    if (++count % 100 === 0) console.log(`Thumbnails: ${count}/${records.length}`)
  })
}
console.log(`Imported ${records.length} records (${Buffer.byteLength(json)} bytes), revision ${REVISION}`)
