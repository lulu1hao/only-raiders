// Print the world-space bounding box and triangle count of a .glb file.
// Usage: node tools/glb-bbox.mjs <file.glb> [more.glb ...]
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { Matrix4, Quaternion, Vector3 } from 'three'

function parseGlb(file) {
  const buf = readFileSync(file)
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a glb: ' + file)
  let off = 12
  let json = null
  let bin = null
  while (off < buf.length) {
    const len = buf.readUInt32LE(off)
    const type = buf.readUInt32LE(off + 4)
    const data = buf.subarray(off + 8, off + 8 + len)
    if (type === 0x4e4f534a) json = JSON.parse(data.toString('utf8'))
    else if (type === 0x004e4942) bin = data
    off += 8 + len
  }
  return { json, bin }
}

function nodeMatrix(node) {
  const m = new Matrix4()
  if (node.matrix) return m.fromArray(node.matrix)
  const t = node.translation || [0, 0, 0]
  const r = node.rotation || [0, 0, 0, 1]
  const s = node.scale || [1, 1, 1]
  return m.compose(new Vector3(...t), new Quaternion(...r), new Vector3(...s))
}

const results = []
for (const file of process.argv.slice(2)) {
  const { json } = parseGlb(file)
  const nodes = json.nodes || []
  const meshes = json.meshes || []
  const accessors = json.accessors || []
  const parent = new Map()
  nodes.forEach((n, i) => (n.children || []).forEach((c) => parent.set(c, i)))

  let min = new Vector3(Infinity, Infinity, Infinity)
  let max = new Vector3(-Infinity, -Infinity, -Infinity)
  let tris = 0
  let prims = 0
  let naniteOnly = 0

  const visit = (i, parentMat) => {
    const n = nodes[i]
    const world = parentMat.clone().multiply(nodeMatrix(n))
    if (n.mesh !== undefined) {
      for (const p of meshes[n.mesh].primitives || []) {
        prims++
        const acc = accessors[p.attributes.POSITION]
        if (p.indices !== undefined) tris += (accessors[p.indices].count || 0) / 3
        if (!acc || !acc.min) continue
        const [ax, ay, az] = acc.min
        const [bx, by, bz] = acc.max
        for (let k = 0; k < 8; k++) {
          const v = new Vector3(k & 1 ? bx : ax, k & 2 ? by : ay, k & 4 ? bz : az).applyMatrix4(world)
          min.min(v)
          max.max(v)
        }
      }
    }
    for (const c of n.children || []) visit(c, world)
  }

  const scene = (json.scenes || [{ nodes: [] }])[json.scene || 0]
  for (const root of scene.nodes || []) visit(root, new Matrix4())

  const hasBox = Number.isFinite(min.x)
  results.push({
    file: basename(file),
    bytes: readFileSync(file).length,
    nodes: nodes.length,
    meshes: meshes.length,
    prims,
    tris: Math.round(tris),
    min: hasBox ? min.toArray().map((v) => +v.toFixed(1)) : null,
    max: hasBox ? max.toArray().map((v) => +v.toFixed(1)) : null,
    size: hasBox ? max.clone().sub(min).toArray().map((v) => +v.toFixed(1)) : null,
    naniteOnly
  })
}
console.log(JSON.stringify(results, null, 1))
