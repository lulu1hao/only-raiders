// Parse F:\arc-export\dam-mapareas.txt (dump of DA_MapAreaInfo_TheDam_02_P)
// into src/data/arcDamMapAreas.json: title, marker X/Y/Z, zoom, spline polygon.
import { readFileSync, writeFileSync } from 'node:fs'

const path = process.argv[2] || 'F:/arc-export/dam-mapareas.txt'
const buf = readFileSync(path)
const src = buf[0] === 0xff && buf[1] === 0xfe ? buf.toString('utf16le') : buf.toString('utf8')
const line = src.split(/\r?\n/).find((l) => l.includes('MapAreas = [')) || src
const start = line.indexOf('{Location=')

const chunks = []
let depth = 0
let cur = ''
for (let i = start; i < line.length; i++) {
  const ch = line[i]
  if (ch === '{') {
    depth++
    if (depth === 1) cur = ''
  }
  if (depth > 0) cur += ch
  if (ch === '}') {
    depth--
    if (depth === 0) chunks.push(cur)
  }
}

const num = (s) => Number.parseFloat(s)
const areas = []
for (const c of chunks) {
  const loc = c.match(/Location=X=(-?[\d.]+) Y=(-?[\d.]+) Z=(-?[\d.]+)/)
  const title = c.match(/Title=([^,]*)/)
  const zoom = c.match(/TargetZoomLevel=(\d+)/)
  if (!loc || !title) continue
  const sp = c.match(/AreaSplinePoints=\[(.*?)\]/s)
  const points = []
  if (sp) {
    for (const m of sp[1].matchAll(/X=(-?[\d.]+) Y=(-?[\d.]+) Z=(-?[\d.]+)/g)) {
      points.push([num(m[1]) / 100, num(m[2]) / 100, num(m[3]) / 100])
    }
  }
  areas.push({
    title: title[1].trim(),
    x: num(loc[1]) / 100,
    y: num(loc[2]) / 100,
    z: num(loc[3]) / 100,
    zoom: zoom ? Number(zoom[1]) : 0,
    spline: points
  })
}

writeFileSync(process.argv[3] || 'src/data/arcDamMapAreas.json', JSON.stringify(areas, null, 1))
console.log(`areas=${areas.length} withSpline=${areas.filter((a) => a.spline.length).length}`)
for (const a of areas.filter((a) => a.spline.length)) {
  console.log(`  ${a.title}: marker=(${a.x.toFixed(0)},${a.y.toFixed(0)}) pts=${a.spline.length}`)
}
