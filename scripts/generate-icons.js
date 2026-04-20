import sharp from 'sharp'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const svgPath = join(__dirname, '../public/favicon.svg')
const outDir = join(__dirname, '../public/icons')

const svg = readFileSync(svgPath)

const sizes = [96, 152, 167, 180, 192, 512]

await Promise.all(
  sizes.map((size) =>
    sharp(svg)
      .resize(size, size)
      .png()
      .toFile(join(outDir, `icon-${size}.png`))
  )
)

// apple-touch-icon is 180
await sharp(svg).resize(180, 180).png().toFile(join(outDir, 'apple-touch-icon.png'))

// maskable — add 20% padding on black bg
for (const size of [192, 512]) {
  const pad = Math.round(size * 0.1)
  const inner = size - pad * 2
  await sharp(svg)
    .resize(inner, inner)
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: '#000000' })
    .png()
    .toFile(join(outDir, `icon-${size}-maskable.png`))
}

console.log('Icons generated ✓')
