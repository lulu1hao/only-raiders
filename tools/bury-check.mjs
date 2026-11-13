// Measure how much of each building mesh sits below the terrain surface.
// Usage: node tools/bury-check.mjs <terrain.glb> <building.glb> [...]
import { meshInstances } from './glb-util.mjs'

const [terrainFile, ...buildings] = process.argv.slice(2)

const index = new Map()
const CELL = 4
let n = 0
for (const m of meshInstances(terrainFile)) {
  const p = m.pos
  for (let i = 0; i < p.length; i += 3) {
    const gx = Math.floor(p[i] / CELL)
    const gz = Math.floor(p[i + 2] / CELL)
    const key = gx + ':' + gz
    let list = index.get(key)
    if (!list) index.set(key, (list = []))
    list.push(p[i], p[i + 1], p[i + 2])
    n++
  }
}

function heightAt(x, z) {
  const gx = Math.floor(x / CELL)
  const gz = Math.floor(z / CELL)
  let best = Infinity
  let bestY = null
  for (let r = 0; r <= 3; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (r > 0 && Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue
        const list = index.get(gx + dx + ':' + (gz + dz))
        if (!list) continue
        for (let i = 0; i < list.length; i += 3) {
          const d = (list[i] - x) ** 2 + (list[i + 2] - z) ** 2
          if (d < best) {
            best = d
            bestY = list[i + 1]
          }
        }
      }
    }
    if (bestY !== null && best <= (CELL * 0.75) ** 2) break
  }
  return bestY
}

const rows = []
for (const file of buildings) {
  const deltas = []
  let below05 = 0
  let below2 = 0
  let total = 0
  let min = Infinity
  let max = -Infinity
  for (const m of meshInstances(file)) {
    const p = m.pos
    const step = Math.max(1, Math.floor((p.length / 3) / 9000))
    for (let v = 0; v < p.length / 3; v += step) {
      const x = p[v * 3]
      const y = p[v * 3 + 1]
      const z = p[v * 3 + 2]
      const h = heightAt(x, z)
      if (h === null) continue
      const d = y - h
      deltas.push(d)
      total++
      if (d < -0.5) below05++
      if (d < -2) below2++
      if (d < min) min = d
      if (d > max) max = d
    }
  }
  deltas.sort((a, b) => a - b)
  if (deltas.length === 0) {
    rows.push({ file: file.replace(/^.*[\\/]/, ''), points: 0, note: 'no overlap with terrain' })
    continue
  }
  const pct = (q) => deltas[Math.min(deltas.length - 1, Math.floor(deltas.length * q))]
  rows.push({
    file: file.replace(/^.*[\\/]/, ''),
    points: total,
    'median(m)': +pct(0.5).toFixed(2),
    'p05(m)': +pct(0.05).toFixed(2),
    'p95(m)': +pct(0.95).toFixed(2),
    'min(m)': +min.toFixed(2),
    'max(m)': +max.toFixed(2),
    'below0.5m%': +((100 * below05) / Math.max(1, total)).toFixed(1),
    'below2m%': +((100 * below2) / Math.max(1, total)).toFixed(1)
  })
}
console.log(JSON.stringify(rows, null, 1))
