import { chromium, webkit, devices } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'

const url = process.env.APP_URL || 'http://127.0.0.1:4173'
const directory = 'test-results'
await mkdir(directory, { recursive: true })
const errors = []
const results = []
const browser = await chromium.launch({ headless: true })
const mobileOptions = { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }
let context = await browser.newContext(mobileOptions)
let page = await context.newPage()
page.on('pageerror', (error) => errors.push(error.message))

async function visible(locator) { await locator.waitFor({ state: 'visible' }) }
async function snapshot(name) { await page.screenshot({ path: `${directory}/${name}.png` }) }
async function checkLayout(name) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  assert.equal(overflow, false, `${name}: horizontal overflow`)
  const controls = await page.locator('.app-shell button:visible').evaluateAll((elements) => elements.filter((el) => el.getBoundingClientRect().height < 43).map((el) => el.textContent || el.getAttribute('aria-label')))
  assert.deepEqual(controls, [], `${name}: small touch controls`)
}

try {
  await page.goto(url)
  await visible(page.getByRole('button', { name: 'Elegir una rutina', exact: true }))
  for (const width of [360, 390, 430, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    await checkLayout(`home-${width}`); await snapshot(`home-${width}`)
  }
  results.push('Home at 360, 390, 430 and desktop: no overflow, touch controls >=44px')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Elegir una rutina', exact: true }).click()
  await visible(page.getByRole('button', { name: /Full body inicial/ }))
  await snapshot('library-390')
  await page.getByRole('button', { name: /Full body inicial/ }).click()
  await page.getByRole('button', { name: 'Usar rutina', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Preparar rutina' })
  await visible(editor)
  await editor.getByLabel('Nombre de la rutina').fill('Plan de prueba')
  const repsInput = editor.getByLabel(/^Repeticiones de/).first()
  await repsInput.fill('')
  assert.equal(await repsInput.inputValue(), '')
  await repsInput.fill('8')
  assert.equal(await repsInput.inputValue(), '8')
  await snapshot('editor-390')
  await page.evaluate(() => document.documentElement.style.setProperty('--viewport-height', '480px'))
  assert.ok((await editor.locator('.sheet-footer').boundingBox()).y + (await editor.locator('.sheet-footer').boundingBox()).height <= 481)
  await snapshot('editor-keyboard-viewport')
  await page.evaluate(() => document.documentElement.style.setProperty('--viewport-height', '844px'))
  await editor.getByRole('button', { name: 'Guardar rutina', exact: true }).click()
  await page.getByRole('button', { name: 'Entrenar', exact: true }).click()
  await page.getByRole('button', { name: /Full body A 5 ejercicios/ }).click()
  await visible(page.getByRole('button', { name: 'Minimizar', exact: true }))
  assert.equal(await page.locator('.session-exercise').count(), 5)
  let first = page.locator('.session-exercise').first()
  await first.getByLabel('Peso de serie 1', { exact: true }).fill('12,5')
  await first.getByLabel('Repeticiones de serie 1', { exact: true }).fill('')
  await page.getByRole('button', { name: 'Minimizar', exact: true }).click()
  await page.getByRole('button', { name: 'Progreso', exact: true }).click()
  await visible(page.getByRole('button', { name: 'Retomar entrenamiento', exact: true }))
  await snapshot('active-browsing-390')
  await page.reload()
  await page.locator('.workout-resume').click()
  assert.equal(await first.getByLabel('Peso de serie 1', { exact: true }).inputValue(), '12,5')
  assert.equal(await first.getByLabel('Repeticiones de serie 1', { exact: true }).inputValue(), '')
  await first.getByLabel('Repeticiones de serie 1', { exact: true }).fill('8')
  await first.getByRole('button', { name: 'Completar serie 1', exact: true }).click()
  await page.getByRole('button', { name: 'Omitir', exact: true }).click()
  await visible(page.getByRole('region', { name: 'Descanso', exact: true }))
  await snapshot('session-390')
  await first.getByRole('button', { name: /^Ver instrucciones/ }).click()
  await page.getByRole('button', { name: 'Ver movimiento', exact: true }).click()
  await page.waitForFunction(() => { const video = document.querySelector('video'); return video && video.readyState >= 2 && video.videoWidth === 180 })
  await snapshot('exercise-video-390')
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click()
  results.push('Routine copy, editable reps, minimize, reload recovery, completed series and MP4 playback')

  await page.evaluate(() => {
    const draft = JSON.parse(localStorage.getItem('gymtrack_active_workout'))
    draft.state.activeWorkout.startTime -= 120000
    draft.state.restTimer.startedAt -= 95000
    localStorage.setItem('gymtrack_active_workout', JSON.stringify(draft))
  })
  const restoredState = await context.storageState({ indexedDB: true })
  await context.close()
  context = await browser.newContext({ ...mobileOptions, storageState: restoredState })
  page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(url)
  await visible(page.locator('.workout-resume'))
  await page.locator('.workout-resume').click()
  first = page.locator('.session-exercise').first()
  assert.equal(await first.getByLabel('Peso de serie 1', { exact: true }).inputValue(), '12,5')
  await visible(page.getByRole('region', { name: 'Descanso', exact: true }).getByText('Listo para seguir', { exact: true }))
  assert.ok(Number((await page.locator('.session-title time').textContent()).split(':')[0]) >= 2)
  results.push('Close/reopen restores completed series and wall-clock workout/rest time')

  const originalSession = await page.evaluate(() => JSON.parse(localStorage.getItem('gymtrack_active_workout')).state.activeWorkout.sessionId)
  await page.getByRole('button', { name: 'Minimizar', exact: true }).click()
  await page.getByRole('button', { name: 'Rutinas', exact: true }).click()
  await page.getByRole('button', { name: 'Retomar', exact: true }).click()
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('gymtrack_active_workout')).state.activeWorkout.sessionId), originalSession)
  await page.evaluate(() => {
    window.__originalAdd = IDBObjectStore.prototype.add
    IDBObjectStore.prototype.add = function (...args) { if (this.name === 'workout_sets') throw new Error('Simulated storage failure'); return window.__originalAdd.apply(this, args) }
  })
  await page.getByRole('button', { name: 'Terminar', exact: true }).click()
  await page.getByRole('button', { name: 'Guardar entrenamiento', exact: true }).click()
  await visible(page.getByRole('alert').filter({ hasText: 'Tus series siguen acá' }))
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('gymtrack_active_workout')).state.activeWorkout.sessionId), originalSession)
  await page.evaluate(() => { IDBObjectStore.prototype.add = window.__originalAdd })
  await page.getByRole('button', { name: 'Guardar entrenamiento', exact: true }).click()
  await visible(page.getByRole('heading', { name: 'Último entrenamiento', exact: true }))
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('gymtrack_active_workout')).state.activeWorkout), null)
  await page.getByRole('button', { name: 'Progreso', exact: true }).click()
  await visible(page.getByRole('heading', { name: 'Historial reciente', exact: true }))
  await snapshot('progress-390')
  results.push('Active session cannot be overwritten; failed save retains draft; retry succeeds and creates history')

  await page.getByRole('button', { name: 'Rutinas', exact: true }).click()
  await page.getByRole('button', { name: 'Ejercicios', exact: true }).click()
  await page.getByLabel('Buscar ejercicio').fill('press banca')
  await visible(page.getByText('Press de banca con barra', { exact: true }))
  await snapshot('catalog-390')
  await page.getByLabel('Grupo muscular').selectOption({ label: 'Pecho' })
  await page.getByLabel('Equipamiento').selectOption('barbell')
  assert.ok(await page.locator('.exercise-list-row').count() > 0)
  results.push('Shared catalog search resolves Spanish aliases and muscle/equipment filters')

  await page.getByRole('button', { name: 'Inicio', exact: true }).click()
  await page.getByRole('button', { name: 'Configuración', exact: true }).click()
  await snapshot('settings-390')
  await page.getByRole('dialog', { name: 'Configuración' }).getByRole('button', { name: 'Cerrar', exact: true }).click()
  await page.getByRole('button', { name: 'Agregar a inicio', exact: true }).click()
  await visible(page.getByRole('dialog', { name: 'Agregar GymTrack a inicio', exact: true }))
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click()
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
  const initialMedia = await page.evaluate(async () => {
    const keys = await caches.keys()
    const precache = await caches.open(keys.find((key) => key.includes('precache')))
    return (await precache.keys()).filter((request) => /\/catalog\/(images|videos)\//.test(request.url)).length
  })
  assert.equal(initialMedia, 0)
  await context.setOffline(true)
  await page.reload()
  await visible(page.getByRole('heading', { name: 'GymTrack', exact: true }))
  await page.getByRole('button', { name: 'Rutinas', exact: true }).click()
  await page.getByRole('button', { name: 'Ejercicios', exact: true }).click()
  await page.getByLabel('Buscar ejercicio').fill('bench press')
  await visible(page.getByText('Press de banca con barra', { exact: true }))
  await snapshot('offline-catalog-390')
  await context.setOffline(false)
  results.push('Install instructions, settings, offline shell/catalog, media excluded from installation cache')
  const iosContext = await browser.newContext({ ...devices['iPhone 13'] })
  const iosPage = await iosContext.newPage()
  await iosPage.goto(url)
  await visible(iosPage.getByRole('button', { name: 'Elegir una rutina', exact: true }))
  await iosPage.getByRole('button', { name: 'Agregar a inicio', exact: true }).click()
  await visible(iosPage.getByText('Abrí esta página en Safari.', { exact: true }))
  await iosPage.screenshot({ path: `${directory}/ios-install-instructions.png` })
  await iosContext.close()
  results.push('iOS installation instructions and reduced visual viewport keep form actions reachable')
  assert.deepEqual(errors, [], 'Unexpected browser JavaScript errors')
} catch (error) {
  await snapshot('failure').catch(() => {})
  const state = await page.evaluate(() => ({ session: JSON.parse(localStorage.getItem('gymtrack_active_workout')), text: document.body.innerText })).catch(() => null)
  await writeFile(`${directory}/failure.json`, JSON.stringify({ message: error.message, state }, null, 2))
  throw error
} finally { await context.close(); await browser.close() }

// WebKit is tested independently; the report records host limitations without claiming device testing.
let webkitResult
try {
  const safari = await webkit.launch({ headless: true })
  const mobile = await safari.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } })
  const tab = await mobile.newPage()
  await tab.goto(url)
  await tab.getByRole('button', { name: 'Elegir una rutina', exact: true }).waitFor()
  await tab.getByRole('button', { name: 'Agregar a inicio', exact: true }).click()
  await tab.getByText('Abrí esta página en Safari.', { exact: true }).waitFor()
  await tab.screenshot({ path: `${directory}/webkit-install-390.png` })
  await safari.close()
  webkitResult = 'WebKit iPhone emulation: app bootstrap and iOS installation instructions passed'
} catch (error) { webkitResult = `Unavailable on this host: ${error.message.split('\n')[0]}` }
await writeFile(`${directory}/browser-report.json`, JSON.stringify({ results, errors, webkit: webkitResult, realDevicesTested: false }, null, 2) + '\n')
console.log(JSON.stringify({ results, webkit: webkitResult }, null, 2))
