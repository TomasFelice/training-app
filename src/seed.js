import { db } from './db'
import { aliasesFor, LEGACY_CATALOG_IDS, muscleLabel } from './lib/catalog'

export const CATALOG_REVISION = '7455efae41b330c265e7cd4b78dfa848e7ce5ebd:es-v1'

export async function importCatalog(records, database = db) {
  if (!Array.isArray(records) || !records.length) throw new Error('El catálogo está vacío')
  const ids = new Set()
  for (const record of records) {
    if (!record.catalogId || !record.name || !record.target || !record.instructionSteps?.length || ids.has(record.catalogId)) {
      throw new Error(`Registro inválido: ${record.catalogId ?? '?'}`)
    }
    ids.add(record.catalogId)
  }
  await database.transaction('rw', database.exercises, database.metadata, async () => {
    const existing = await database.exercises.toArray()
    const catalogMap = new Map(existing.filter((e) => e.catalogId).map((e) => [e.catalogId, e]))
    const legacyMap = new Map(existing.filter((e) => !e.catalogId && LEGACY_CATALOG_IDS[e.name])
      .map((e) => [LEGACY_CATALOG_IDS[e.name], e]))
    const additions = []
    const updates = []
    for (const record of records) {
      const saved = catalogMap.get(record.catalogId) ?? legacyMap.get(record.catalogId)
      const details = { ...record, catalogName: record.originalName ?? record.name, muscleGroup: muscleLabel(record.target),
        aliases: [...new Set([record.name, record.originalName, ...aliasesFor(record.catalogId),
          ...(saved?.aliases ?? [])].filter(Boolean))] }
      if (saved) {
        // Translate untouched catalog names; keep custom and legacy Spanish names.
        const wasDefaultName = saved.name === saved.catalogName || saved.name === record.originalName
        updates.push({ ...saved, ...details, name: wasDefaultName ? record.name : saved.name,
          muscleGroup: saved.muscleGroup ?? details.muscleGroup })
      } else additions.push(details)
    }
    await database.exercises.bulkAdd(additions)
    await database.exercises.bulkPut(updates)
    await database.metadata.put({ key: 'catalog', revision: CATALOG_REVISION, count: records.length })
  })
}

export async function initializeCatalog() {
  await db.open()
  const imported = await db.metadata.get('catalog')
  if (imported?.revision === CATALOG_REVISION) return
  const response = await fetch('/catalog/exercises.json')
  if (!response.ok) throw new Error('No se pudo cargar el catálogo. Volvé a intentar.')
  await importCatalog(await response.json())
}
