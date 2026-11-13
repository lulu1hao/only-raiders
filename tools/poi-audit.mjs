// Audit POI exports against the game's DA_MapAreaInfo coordinates.
// Usage: node tools/poi-audit.mjs <arcDamWorld.json> <coarseDir>
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { meshInstances } from './glb-util.mjs'

const [worldJson, coarseDir] = process.argv.slice(2)
const world = JSON.parse(readFileSync(worldJson, 'utf8'))

function bbox(file) {
  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
  let tris = 0
  for (const m of meshInstances(file)) {
    const p = m.pos
    for (let i = 0; i < p.length; i += 3) {
      if (p[i] < minX) minX = p[i]
      if (p[i] > maxX) maxX = p[i]
      if (p[i + 1] < minY) minY = p[i + 1]
      if (p[i + 1] > maxY) maxY = p[i + 1]
      if (p[i + 2] < minZ) minZ = p[i + 2]
      if (p[i + 2] > maxZ) maxZ = p[i + 2]
    }
    if (m.idx) tris += m.idx.length / 3
  }
  return { minX, minY, minZ, maxX, maxY, maxZ, tris }
}

// Distance from a POI marker to the closest triangle centroid of its own bake.
function nearInfo(file, x, z) {
  let best = Infinity
  let within100 = 0
  let total = 0
  let top = -Infinity
  for (const m of meshInstances(file)) {
    const p = m.pos
    const step = Math.max(3, Math.floor(Math.floor(p.length / 3) / 20000) * 3)
    for (let i = 0; i + 8 < p.length; i += step) {
      const cx = (p[i] + p[i + 3] + p[i + 6]) / 3
      const cz = (p[i + 2] + p[i + 5] + p[i + 8]) / 3
      const d = Math.hypot(cx - x, cz - z)
      if (d < best) best = d
      if (d <= 100) within100++
      total++
    }
  }
  return { nearest: best, within100: (100 * within100) / Math.max(1, total) }
}

const rows = []
let totalBytes = 0
let totalTris = 0
for (const poi of world.pois) {
  const file = join(coarseDir, poi.file.replace(/^poi-coarse[\\/]/, ''))
  let b
  try {
    b = bbox(file)
  } catch (e) {
    rows.push({ title: poi.title, error: String(e.message).slice(0, 60) })
    continue
  }
  const bytes = statSync(file).size
  totalBytes += bytes
  totalTris += b.tris
  const cx = (b.minX + b.maxX) / 2
  const cz = (b.minZ + b.maxZ) / 2
  const inBox = poi.x >= b.minX - 1 && poi.x <= b.maxX + 1 && poi.y >= b.minZ - 1 && poi.y <= b.maxZ + 1
  const near = nearInfo(file, poi.x, poi.y)
  rows.push({
    title: poi.title,
    z: poi.zoom,
    mb: +(bytes / 1048576).toFixed(2),
    tris: Math.round(b.tris),
    'dx(m)': +(cx - poi.x).toFixed(0),
    'dy(m)': +(cz - poi.y).toFixed(0),
    'nearest(m)': +near.nearest.toFixed(0),
    'in100m%': +near.within100.toFixed(0),
    'w(m)': +(b.maxX - b.minX).toFixed(0),
    'd(m)': +(b.maxZ - b.minZ).toFixed(0),
    'y(m)': `${b.minY.toFixed(0)}..${b.maxY.toFixed(0)}`,
    centerIn: inBox ? 'yes' : 'NO'
  })
}
console.log(JSON.stringify(rows, null, 0))
console.log(
  `POIs=${rows.filter((r) => !r.error).length}/${world.pois.length} bytes=${(totalBytes / 1048576).toFixed(1)}MB tris=${totalTris} outside=${rows.filter((r) => r.centerIn === 'NO').length}`
)
