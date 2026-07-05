import sharp from "sharp"
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "fs"

const SRC = "public/favicon.png"
const BACKUP = "public/favicon.original.png"
const OUT = "public/favicon.png"

// Output size + margin (fraction of the square canvas kept as breathing room).
const CANVAS = 512
const MARGIN = 0.06 // 6% padding on each side — mark fills ~88% of the frame

async function main() {
  if (!existsSync(SRC)) throw new Error(`missing ${SRC}`)

  // One-time backup of the original so we can always restore.
  if (!existsSync(BACKUP)) {
    copyFileSync(SRC, BACKUP)
    console.log(`backed up original -> ${BACKUP}`)
  }

  const input = readFileSync(BACKUP) // always work from the pristine original

  const before = await sharp(input).metadata()
  console.log(`original: ${before.width}x${before.height}`)

  // 1) Trim the surrounding transparent/uniform padding to get the tight mark.
  const trimmed = await sharp(input).trim({ threshold: 10 }).toBuffer()
  const t = await sharp(trimmed).metadata()
  console.log(`trimmed:  ${t.width}x${t.height}`)

  // 2) Fit the trimmed mark into a square inner box (canvas minus margin),
  //    preserving aspect ratio, then extend with transparency to a square canvas.
  const inner = Math.round(CANVAS * (1 - MARGIN * 2))

  const resized = await sharp(trimmed)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer()
  const r = await sharp(resized).metadata()

  const left = Math.round((CANVAS - r.width) / 2)
  const top = Math.round((CANVAS - r.height) / 2)

  const out = await sharp({
    create: {
      width: CANVAS,
      height: CANVAS,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, left, top }])
    .png()
    .toBuffer()

  writeFileSync(OUT, out)
  const f = await sharp(out).metadata()
  console.log(`wrote ${OUT}: ${f.width}x${f.height} (mark fills ~${Math.round((1 - MARGIN * 2) * 100)}%)`)
}

main().catch((e) => { console.error(e); process.exit(1) })
