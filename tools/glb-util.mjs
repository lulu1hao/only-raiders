// Minimal GLB reader: JSON + BIN chunk, node world transforms, triangle access.
import { readFileSync } from 'node:fs'
import { Matrix4, Quaternion, Vector3 } from 'three'

export function parseGlb(file) {
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

export function nodeMatrix(node) {
  const m = new Matrix4()
  if (node.matrix) return m.fromArray(node.matrix)
  const t = node.translation || [0, 0, 0]
  const r = node.rotation || [0, 0, 0, 1]
  const s = node.scale || [1, 1, 1]
  return m.compose(new Vector3(...t), new Quaternion(...r), new Vector3(...s))
}

function readAccessor(json, bin, index) {
  const acc = json.accessors[index]
  const view = json.bufferViews[acc.bufferView]
  const compType = acc.componentType
  const type = acc.type
  const nComp = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[type]
  const bytes = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }[compType]
  const base = (view.byteOffset || 0) + (acc.byteOffset || 0)
  const stride = view.byteStride || bytes * nComp
  const isFloatOrNorm = compType === 5126 || acc.normalized
  const out = new (isFloatOrNorm ? Float32Array : Uint32Array)(acc.count * nComp)
  for (let i = 0; i < acc.count; i++) {
    const p = base + i * stride
    for (let c = 0; c < nComp; c++) {
      const q = p + c * bytes
      let val =
        compType === 5126 ? bin.readFloatLE(q)
        : compType === 5125 ? bin.readUInt32LE(q)
        : compType === 5123 ? bin.readUInt16LE(q)
        : compType === 5122 ? bin.readInt16LE(q)
        : compType === 5120 ? bin.readInt8(q)
        : bin.readUInt8(q)
      if (acc.normalized) {
        if (compType === 5123) val /= 65535
        else if (compType === 5122) val = Math.max(-1, val / 32767)
        else if (compType === 5121) val /= 255
        else if (compType === 5120) val = Math.max(-1, val / 127)
      }
      out[i * nComp + c] = val
    }
  }
  return { data: out, count: acc.count, nComp }
}

// Yields {pos: Float32Array(xyz world), idx: Uint32Array, name} for every mesh instance.
export function* meshInstances(file) {
  const { json, bin } = parseGlb(file)
  const nodes = json.nodes || []
  const meshes = json.meshes || []
  const visit = function* (i, parentMat) {
    const n = nodes[i]
    const world = parentMat.clone().multiply(nodeMatrix(n))
    if (n.mesh !== undefined) {
      for (const p of meshes[n.mesh].primitives || []) {
        const pos = readAccessor(json, bin, p.attributes.POSITION)
        const out = new Float32Array(pos.count * 3)
        const v = new Vector3()
        for (let k = 0; k < pos.count; k++) {
          v.set(pos.data[k * 3], pos.data[k * 3 + 1], pos.data[k * 3 + 2]).applyMatrix4(world)
          out[k * 3] = v.x
          out[k * 3 + 1] = v.y
          out[k * 3 + 2] = v.z
        }
        const idx = p.indices !== undefined ? readAccessor(json, bin, p.indices).data : null
        yield { pos: out, idx, count: pos.count, name: n.name || '' }
      }
    }
    for (const c of n.children || []) yield* visit(c, world)
  }
  const scene = (json.scenes || [{ nodes: [] }])[json.scene || 0]
  for (const root of scene.nodes || []) yield* visit(root, new Matrix4())
}
