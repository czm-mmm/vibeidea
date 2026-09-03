import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { cloudflareHeadersFile, htmlSecurityPolicy } from '../config/security.ts'

const dist = new URL('../dist/', import.meta.url)
const html = await readFile(new URL('index.html', dist), 'utf8')
const headers = await readFile(new URL('_headers', dist), 'utf8')
assert.equal(headers, cloudflareHeadersFile(), 'Built Cloudflare headers must match the source policy')
const cspMeta = html.match(/<meta\b[^>]*http-equiv="Content-Security-Policy"[^>]*>/i)?.[0]
const cspContent = cspMeta?.match(/\bcontent="([^"]*)"/)?.[1]
assert.ok(cspContent, 'Both hosts need the baseline CSP meta tag')
assert.equal(cspContent.replace(/&#(?:39|x27);/gi, "'"), htmlSecurityPolicy, 'HTML entity encoding must preserve the policy')
assert.ok(html.indexOf('http-equiv="Content-Security-Policy"') < html.indexOf('<script'), 'CSP must precede scripts')
assert.ok(!/<meta[^>]*frame-ancestors/i.test(html), 'frame-ancestors cannot be enforced through HTML meta')

const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
assert.ok(scripts.length > 0, 'The production entry script is missing')
for (const [, attributes, body] of scripts) {
  const source = attributes.match(/\bsrc="([^"]+)"/)?.[1]
  assert.ok(source?.startsWith('./'), 'Production scripts must be relative, same-origin assets')
  assert.equal(body.trim(), '', 'Inline scripts need a deliberate CSP review')
  await readFile(new URL(source, dist))
}
for (const match of html.matchAll(/<link\b[^>]*href="([^"]+)"/gi)) {
  assert.ok(match[1].startsWith('./'), 'Production links must work on both root and GitHub Pages paths')
  await readFile(new URL(match[1], dist))
}

const entries = await readdir(dist, { recursive: true })
for (const entry of entries) {
  assert.ok(!/(^|[/\\])(?:\.env(?:\..*)?|\.git|node_modules)(?:$|[/\\])/i.test(entry), `Private build entry: ${entry}`)
  assert.ok(!/\.(?:map|pem|key|p12)$/i.test(entry), `Unexpected sensitive build file: ${entry}`)
}
const worker = await readFile(new URL('sw.js', dist), 'utf8')
assert.ok(worker.includes('index.html'), 'PWA must still precache the entry page')
assert.ok(!worker.includes('_headers'), 'Cloudflare configuration must not enter the offline cache')
const sounds = entries.filter(entry => /(?:^|[/\\])(?:select|play)-[^/\\]+\.wav$/.test(entry))
assert.equal(sounds.length, 2, 'Both approved sound samples must ship as same-origin assets')
for (const sound of sounds) {
  assert.ok(worker.includes(sound.replaceAll('\\', '/')), `Sound is missing from the offline cache: ${sound}`)
  const bytes = await readFile(new URL(sound.replaceAll('\\', '/'), dist))
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', 'Audio must remain browser-compatible WAV')
  assert.equal(bytes.toString('ascii', 8, 12), 'WAVE')
}
console.log(`Security build checks passed: ${fileURLToPath(dist)} (${entries.length} entries).`)
