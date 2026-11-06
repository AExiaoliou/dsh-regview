/**
 * End-to-end smoke check for a running Web GUI.
 *
 * Launches headless Chrome against the given URL, waits for the dsh-regview
 * sidebar entry, clicks it, asserts the five category tabs, and writes a
 * screenshot. Uses the Chrome DevTools Protocol directly over Node's built-in
 * WebSocket, so the repository needs no browser automation dependency.
 */
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

function flag(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const baseUrl = flag('url', process.env.DSH_WEB_URL ?? 'http://127.0.0.1:3080')
const launchUrl = new URL(baseUrl)
if (launchUrl.pathname === '') launchUrl.pathname = '/'
const output = flag('out', 'artifacts/regview-panel.png')
const prefix = flag('prefix', 'regview')
const width = Number(flag('width', '1440'))
const height = Number(flag('height', '1000'))
const chromePath = flag('chrome', process.env.CHROME ?? 'google-chrome')
const port = Number(flag('port', '9333'))
const userDataDir = await mkdtemp(join(tmpdir(), 'dsh-regview-chrome-'))
const labels = ['注册中心', 'Registry']

const chrome = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--no-first-run',
  '--no-default-browser-check',
  '--no-sandbox',
  '--lang=zh-CN',
  '--accept-lang=zh-CN,zh',
  `--user-data-dir=${userDataDir}`,
  `--remote-debugging-port=${port}`,
  `--window-size=${width},${height}`,
  `${launchUrl.href}`,
], { stdio: ['ignore', 'ignore', 'pipe'] })

let stderr = ''
chrome.stderr.on('data', (chunk) => { stderr += chunk.toString() })

async function fetchJson(path, timeoutMs = 30_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}${path}`)
      if (response.ok) return await response.json()
    } catch {
      // Chrome has not bound the debugging port yet.
    }
    await delay(200)
  }
  throw new Error(`Chrome debugging endpoint did not answer; stderr: ${stderr.slice(-2000)}`)
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url)
    const pending = new Map()
    let nextId = 0
    socket.addEventListener('error', event => reject(new Error(`WebSocket error: ${String(event.message ?? '')}`)))
    socket.addEventListener('open', () => {
      resolve({
        send(method, params = {}) {
          const id = ++nextId
          return new Promise((resolveCall, rejectCall) => {
            pending.set(id, { resolve: resolveCall, reject: rejectCall })
            socket.send(JSON.stringify({ id, method, params }))
          })
        },
        close() { socket.close() },
      })
    })
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(typeof event.data === 'string' ? event.data : String(event.data))
      if (typeof message.id !== 'number') return
      const call = pending.get(message.id)
      if (call === undefined) return
      pending.delete(message.id)
      if (message.error !== undefined) call.reject(new Error(message.error.message))
      else call.resolve(message.result)
    })
  })
}

async function waitFor(cdp, expression, timeoutMs, description) {
  const started = Date.now()
  let last
  while (Date.now() - started < timeoutMs) {
    try {
      last = await evaluate(cdp, expression)
      if (last) return last
    } catch (error) {
      last = String(error)
    }
    await delay(250)
  }
  throw new Error(`Timed out waiting for ${description}; last value: ${JSON.stringify(last)}`)
}

async function evaluate(cdp, expression) {
  const response = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })
  if (response.exceptionDetails !== undefined) {
    throw new Error(response.exceptionDetails.text ?? 'Runtime.evaluate failed')
  }
  return response.result?.value
}

let result
let cdp
try {
  const targets = await fetchJson('/json/list')
  const page = targets.find(target => target.type === 'page' && target.url.startsWith('http'))
  if (page === undefined) throw new Error(`No page target: ${JSON.stringify(targets)}`)
  cdp = await connect(page.webSocketDebuggerUrl)
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  })

  await waitFor(cdp, `(() => [...document.querySelectorAll('button[aria-label]')].some(el => ${JSON.stringify(labels)}.includes(el.getAttribute('aria-label'))))()`, 45_000, 'the sidebar registry entry')
  // The first boot of a fresh profile may show the release-notes dialog; dismiss
  // it so the screenshot shows the inspector rather than the overlay.
  await evaluate(cdp, `(() => {
    const button = [...document.querySelectorAll('button')].find(el => ['继续', 'Continue'].includes((el.textContent ?? '').trim()))
    if (button) button.click()
    return button !== undefined
  })()`)
  await delay(300)
  const clicked = await evaluate(cdp, `(() => {
    const button = [...document.querySelectorAll('button[aria-label]')].find(el => ${JSON.stringify(labels)}.includes(el.getAttribute('aria-label')))
    if (!button) return { ok: false }
    button.click()
    return { ok: true }
  })()`)
  if (!clicked?.ok) throw new Error('The sidebar registry entry could not be clicked')

  await waitFor(cdp, `(() => document.querySelector('.dsh-regview-page h1')?.textContent !== undefined)()`, 20_000, 'the registry panel')
  await waitFor(cdp, `(() => document.querySelectorAll('.dsh-regview-tabs [role="tab"]').length >= 5)()`, 20_000, 'five category tabs')
  await delay(750)

  const tabs = await evaluate(cdp, `[...document.querySelectorAll('.dsh-regview-tabs [role="tab"]')].map(el => el.textContent)`)
  const title = await evaluate(cdp, `document.querySelector('.dsh-regview-page h1')?.textContent ?? ''`)
  const sections = []
  const slugs = ['resources', 'sidebar-tabs', 'conversation-views', 'document-previews', 'slots']
  const screenshots = []
  for (let index = 0; index < tabs.length; index += 1) {
    await evaluate(cdp, `document.querySelectorAll('.dsh-regview-tabs [role="tab"]')[${index}]?.click()`)
    await delay(450)
    await evaluate(cdp, `(() => {
      const button = [...document.querySelectorAll('button')].find(el => ['继续', 'Continue'].includes((el.textContent ?? '').trim()))
      if (button) button.click()
      return button !== undefined
    })()`)
    await delay(200)
    const tabShot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    const tabPath = `artifacts/${prefix}-${slugs[index] ?? String(index)}.png`
    await mkdir('artifacts', { recursive: true })
    await writeFile(tabPath, Buffer.from(tabShot.data, 'base64'))
    screenshots.push(tabPath)
    sections.push(await evaluate(cdp, `(() => {
      const rows = [...document.querySelectorAll('.dsh-regview-table tbody tr, .dsh-regview-tree-row')]
      return {
        tab: document.querySelectorAll('.dsh-regview-tabs [role="tab"]')[${index}]?.textContent ?? '',
        rows: rows.length,
        sample: rows.slice(0, 3).map(row => row.innerText.replace(/\\s+/g, ' ').trim()),
        empty: document.querySelector('.dsh-regview-empty')?.textContent ?? null,
        error: document.querySelector('.dsh-regview-error')?.textContent ?? null,
      }
    })()`))
  }
  await evaluate(cdp, `document.querySelectorAll('.dsh-regview-tabs [role="tab"]')[0]?.click()`)
  await delay(500)
  // The release-notes dialog can mount after the sidebar does; dismiss it again
  // immediately before capturing the panel.
  await evaluate(cdp, `(() => {
    const button = [...document.querySelectorAll('button')].find(el => ['继续', 'Continue'].includes((el.textContent ?? '').trim()))
    if (button) button.click()
    return button !== undefined
  })()`)
  await delay(600)
  const rows = await evaluate(cdp, `document.querySelectorAll('.dsh-regview-table tbody tr, .dsh-regview-tree-row').length`)
  const bodyText = await evaluate(cdp, `document.body.innerText.slice(0, 4000)`)
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await mkdir(output.slice(0, Math.max(0, output.lastIndexOf('/'))) || '.', { recursive: true })
  await writeFile(output, Buffer.from(shot.data, 'base64'))
  result = { ok: true, url: baseUrl, title, tabs, rows, sections, screenshots, screenshot: output }
  console.log(JSON.stringify(result, null, 2))
  if (!Array.isArray(tabs) || tabs.length < 5) {
    console.error('Expected five category tabs; body excerpt:\n' + bodyText)
    process.exitCode = 1
  }
} catch (error) {
  console.error(`smoke failed: ${error instanceof Error ? error.message : String(error)}`)
  console.error(`Chrome stderr:\n${stderr.slice(-2000)}`)
  process.exitCode = 1
} finally {
  cdp?.close()
  chrome.kill('SIGTERM')
  await delay(300)
  await rm(userDataDir, { recursive: true, force: true }).catch(() => {})
}
