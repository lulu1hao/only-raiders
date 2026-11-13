// Screenshot the running dev page through the headless Edge CDP endpoint.
// Usage: node tools/shot.mjs out.png [--url=http://localhost:5180/] [--expr="js"] [--wait=9000] [--w=1600] [--h=1000]
import fs from 'node:fs'

const args = process.argv.slice(2)
const out = args.find((a) => !a.startsWith('--')) || 'shot.png'
const opt = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}
const url = opt('url', 'http://localhost:5180/')
const expr = opt('expr', 'null')
const wait = Number(opt('wait', 9000))
const width = Number(opt('w', 1600))
const height = Number(opt('h', 1000))

const endpoint = `http://127.0.0.1:${opt('port', 9222)}`
let list = await (await fetch(endpoint + '/json/list')).json()
let page = list.find((p) => p.type === 'page' && /localhost:5180|127\.0\.0\.1:5180/.test(p.url))
if (!page) {
  const res = await fetch(endpoint + '/json/new?' + encodeURIComponent(url), { method: 'PUT' })
  page = await res.json()
}
const ws = new WebSocket(page.webSocketDebuggerUrl)
let seq = 0
const pending = new Map()
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m)
    pending.delete(m.id)
  }
  if (m.method === 'Runtime.exceptionThrown') {
    console.log('[exception]', m.params.exceptionDetails.text, m.params.exceptionDetails.exception?.description ?? '')
  }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    console.log('[console.error]', m.params.args.map((a) => a.value ?? a.description).join(' '))
  }
}
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = ++seq
    pending.set(id, resolve)
    ws.send(JSON.stringify({ id, method, params }))
  })
await new Promise((r) => { ws.onopen = r })
await send('Runtime.enable')
await send('Page.enable')
await send('Network.enable')
await send('Network.setCacheDisabled', { cacheDisabled: true })
await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url })
await new Promise((r) => setTimeout(r, wait))
if (expr && expr !== 'null') {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  console.log('RESULT', JSON.stringify(r.result?.result?.value ?? r.result?.exceptionDetails?.text ?? r.result))
  await new Promise((r) => setTimeout(r, 1200))
}
const shot = await send('Page.captureScreenshot', { format: 'png' })
fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'))
console.log('saved', out)
ws.close()
