import { mkdir, readFile, writeFile, stat, rename, unlink } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { spawn } from 'node:child_process'
import bundledFfmpeg from 'ffmpeg-static'
import sharp from 'sharp'
import { CACHE, ROOT, REVISION, sourceRecords, download, parallel } from './catalog-source.js'

const args = process.argv.slice(2)
const argument = (name) => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
const ffmpeg = argument('--ffmpeg') || process.env.FFMPEG_PATH || bundledFfmpeg
const sample = args.includes('--sample')
const limit = sample ? 12 : Number(argument('--limit')) || Infinity
const concurrency = Math.max(1, Math.min(8, Number(argument('--concurrency')) || 4))
const records = await sourceRecords()
// Sample across the entire catalog rather than only the first exercise category.
const selected = sample ? Array.from({ length: 12 }, (_, i) => records[Math.floor(i * records.length / 12)]) : records.slice(0, limit)
const outputRoot = resolve(ROOT, 'public/catalog')
const reportPath = resolve(ROOT, `reports/media-${sample ? 'sample' : 'conversion'}.json`)
const configuration = { codec: 'libx264', pixelFormat: 'yuv420p', crf: 23, preset: 'slow', resolution: '180x180', audio: false, fpsMode: 'passthrough', timeBase: '1:100' }

function run(arguments_) {
  return new Promise((resolve, reject) => {
    const process_ = spawn(ffmpeg, arguments_, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    process_.stderr.on('data', (data) => { stderr = (stderr + data).slice(-8000) })
    process_.on('error', reject)
    process_.on('close', (code) => code === 0 ? resolve(stderr) : reject(new Error(stderr || `FFmpeg exit ${code}`)))
  })
}

let previous = {}
try { previous = JSON.parse(await readFile(resolve(ROOT, 'reports/media-conversion.json'), 'utf8')) } catch { /* First run. */ }
const verified = new Map((previous.files || []).filter((f) => !f.error).map((f) => [f.catalogId, f]))
const files = []
await parallel(selected, concurrency, async (record) => {
  const output = record.gif_url.replace(/\.gif$/, '.mp4')
  const destination = resolve(outputRoot, output)
  try {
    const bytes = await download(record.gif_url, resolve(CACHE, record.gif_url))
    const input = await sharp(bytes, { animated: true }).metadata()
    if (input.width !== 180 || input.pageHeight !== 180) throw new Error('Source dimensions must be 180x180')
    const gifDuration = (input.delay ?? []).reduce((sum, ms) => sum + ms, 0) / 1000
    await mkdir(dirname(destination), { recursive: true })
    const cached = verified.get(record.id)
    let resume = false
    try { resume = previous.revision === REVISION && JSON.stringify(previous.configuration) === JSON.stringify(configuration) && cached?.mp4Bytes === (await stat(destination)).size } catch { /* Missing output. */ }
    if (!resume) {
      const temporary = destination.replace(/\.mp4$/, '.partial.mp4')
      await run(['-hide_banner', '-loglevel', 'error', '-y', '-ignore_loop', '1', '-i', resolve(CACHE, record.gif_url),
        '-an', '-vf', 'scale=180:180', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23',
        '-preset', 'slow', '-fps_mode', 'passthrough', '-enc_time_base', '1:100', '-movflags', '+faststart', temporary])
      // Decode the entire file to catch truncated/corrupt conversions before publishing it.
      const probe = await run(['-hide_banner', '-loglevel', 'info', '-i', temporary, '-f', 'null', '-'])
      const duration = probe.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/)
      const seconds = duration ? Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]) : NaN
      if (!probe.includes('180x180') || !Number.isFinite(seconds) || Math.abs(seconds - gifDuration) > 0.02) throw new Error(`Duration mismatch: GIF ${gifDuration}s vs MP4 ${seconds}s`)
      await rename(temporary, destination)
    }
    files.push({ catalogId: record.id, gifBytes: bytes.length, mp4Bytes: (await stat(destination)).size, durationSeconds: gifDuration, output, verified: true })
  } catch (error) {
    await unlink(destination.replace(/\.mp4$/, '.partial.mp4')).catch(() => {})
    files.push({ catalogId: record.id, error: error.message })
  }
  if (files.length % 50 === 0) console.log(`Converted: ${files.length}/${selected.length}`)
})
files.sort((a, b) => a.catalogId.localeCompare(b.catalogId))
const gifBytes = files.reduce((sum, f) => sum + (f.gifBytes || 0), 0)
const mp4Bytes = files.reduce((sum, f) => sum + (f.mp4Bytes || 0), 0)
const report = { revision: REVISION, configuration, count: files.length, errors: files.filter((f) => f.error).length,
  gifBytes, mp4Bytes, savingsPercent: gifBytes ? Math.round((1 - mp4Bytes / gifBytes) * 10000) / 100 : 0, files }
await mkdir(dirname(reportPath), { recursive: true })
await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n')
if (!sample) {
  await writeFile(resolve(outputRoot, 'media-manifest.json'), JSON.stringify({ revision: REVISION, configuration,
    files: Object.fromEntries(files.filter((f) => !f.error).map((f) => [f.catalogId, `/catalog/${f.output}`])) }, null, 2) + '\n')
}
console.log(JSON.stringify({ count: report.count, errors: report.errors, gifBytes, mp4Bytes, savingsPercent: report.savingsPercent }))
if (report.errors) process.exitCode = 1
