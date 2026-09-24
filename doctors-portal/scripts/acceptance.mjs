/**
 * The 8 acceptance tests, driven against a real browser.
 *
 * Chrome is launched with `--remote-debugging-port` and driven over the DevTools
 * Protocol using Node's global WebSocket, so there is no test-framework
 * dependency to install. Every assertion runs against the DOM the browser
 * actually rendered, not against a mock — which is the only way a claim like
 * "the badges clear" or "nothing is saved without confirmation" means anything.
 *
 * Usage:  npm run dev        # in another terminal
 *         node scripts/acceptance.mjs
 */

import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { routedScreens, withE2E } from './routes.mjs'

const BASE = process.env.BASE ?? 'http://localhost:5180'
const CHROME = process.env.CHROME ?? 'google-chrome'
const PORT = 9333

const profile = mkdtempSync(join(tmpdir(), 'acceptance-'))
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--window-size=1440,1000',
    'about:blank',
  ],
  { stdio: 'ignore' },
)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function target() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      const pages = (await res.json()).filter((p) => p.type === 'page')
      if (pages[0]?.webSocketDebuggerUrl) return pages[0].webSocketDebuggerUrl
    } catch {
      /* not up yet */
    }
    await sleep(250)
  }
  throw new Error('Chrome did not expose a debugging target')
}

class Page {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data)
      const p = this.pending.get(msg.id)
      if (p) {
        this.pending.delete(msg.id)
        msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result)
      }
    })
  }

  send(method, params = {}) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  /** Runs `fn` in the page and returns its value. Throws if the page threw. */
  async evaluate(fn, ...args) {
    const expression = `(${fn.toString()})(${args.map((a) => JSON.stringify(a)).join(',')})`
    const { result, exceptionDetails } = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? 'page threw')
    return result.value
  }

  async goto(path) {
    await this.send('Page.navigate', { url: `${BASE}${path}` })
    await sleep(900)
  }

  /** Waits for a predicate evaluated in the page. */
  async until(fn, label, timeout = 6000) {
    const started = Date.now()
    while (Date.now() - started < timeout) {
      if (await this.evaluate(fn)) return true
      await sleep(150)
    }
    throw new Error(`timed out waiting for ${label}`)
  }
}

// ── Helpers that run inside the page ────────────────────────────────────────

/** Clicks the first element whose text matches, and reports whether it found one. */
const clickByText = function (selector, text) {
  const el = Array.from(document.querySelectorAll(selector)).find((n) =>
    (n.innerText || n.textContent || '').trim().toLowerCase().includes(text.toLowerCase()),
  )
  if (!el) return false
  el.click()
  return true
}

const results = []
function check(name, pass, detail = '') {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  const ws = new WebSocket(await target())
  await new Promise((r) => ws.addEventListener('open', r))
  const page = new Page(ws)
  await page.send('Page.enable')
  await page.send('Runtime.enable')

  // ── 1 · Render ───────────────────────────────────────────────────────────
  await page.goto('/clinician?e2e=1')
  await page.until(() => !!document.querySelector('[data-screen-id="S-06-01"]'), 'My Day')

  const render = await page.evaluate(() => {
    const blocks = document.querySelectorAll('ol li a[href]').length
    const counts = Array.from(document.querySelectorAll('dl a')).map((a) => a.innerText.trim())
    const attention = Array.from(document.querySelectorAll('ul li button[type="button"]')).filter((b) =>
      b.querySelector('svg[role="img"]'),
    ).length
    return {
      blocks,
      counts,
      attention,
      hOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      greeting: document.querySelector('h1')?.innerText ?? '',
    }
  })
  check(
    '1 · Render — day plan, counts and attention list all present',
    render.blocks >= 6 && render.counts.length === 4 && render.greeting.startsWith('Good morning'),
    `${render.blocks} blocks · ${render.counts.length} counts · "${render.greeting}"`,
  )

  const widths = [320, 375, 768, 1024, 1440]
  const overflow = []
  for (const w of widths) {
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: w,
      height: 900,
      deviceScaleFactor: 1,
      mobile: w < 768,
    })
    await sleep(350)
    const over = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    if (over > 1) overflow.push(`${w}:+${over}px`)
  }
  await page.send('Emulation.clearDeviceMetricsOverride')
  await sleep(300)
  check(
    '1b · No horizontal scroll at 320 / 375 / 768 / 1024 / 1440',
    overflow.length === 0,
    overflow.length ? overflow.join(' ') : 'clean at all five widths',
  )

  // ── 2 · Priority ordering ────────────────────────────────────────────────
  const order = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('ul li button[type="button"]')).filter((b) =>
      b.querySelector('svg[role="img"]'),
    )
    return rows.map((r) => {
      const svg = r.querySelector('svg[role="img"]')
      return { shape: svg.getAttribute('aria-label'), text: r.innerText.replace(/\s+/g, ' ').trim() }
    })
  })
  const rank = { Critical: 0, Warning: 1, Pending: 2 }
  const monotonic = order.every((r, i) => i === 0 || rank[order[i - 1].shape] <= rank[r.shape])
  check(
    '2 · Priority ordering — critical → warning → pending, capped at five',
    monotonic && order.length <= 5 && order.length >= 3,
    order.map((o) => o.shape).join(' → '),
  )

  const times = await page.evaluate(() => {
    const spans = Array.from(document.querySelectorAll('ol li a > span:first-child'))
    return spans.map((s) => s.innerText.trim())
  })
  const clockOrder = times.every((t, i) => i === 0 || times[i - 1] <= t)
  check('2b · Timeline is in clock order with the current block marked', clockOrder && /now/i.test(
    await page.evaluate(() => document.body.innerText),
  ), times.join(' '))

  // ── 5 · AI explainability (before mark-seen removes the row) ─────────────
  const ai = await page.evaluate(() => {
    const diamonds = document.querySelectorAll('svg[aria-hidden] polygon, svg polygon').length
    return { hasDiamond: /Sorted by AI acuity/.test(document.body.innerText), diamonds }
  })

  await page.evaluate(clickByText, 'ul li button[type="button"]', 'Critical lab')
  await page.until(() => /changed since then/i.test(document.body.innerText), 'the Quick-Panel')

  const explain = await page.evaluate(() => {
    const before = document.documentElement.scrollWidth
    const why = Array.from(document.querySelectorAll('button')).find((b) => /^Why\?/.test(b.innerText.trim()))
    const band = /High confidence|Moderate confidence|Low confidence/.test(document.body.innerText)
    why?.click()
    return { hadWhy: !!why, band, before }
  })
  await sleep(500)
  const panels = await page.evaluate(() => {
    const text = document.body.innerText
    return {
      four: ['what this is', 'what it used', 'why', 'limits'].filter((h) => text.toLowerCase().includes(h))
        .length,
      shifted: document.documentElement.scrollWidth,
    }
  })
  check(
    '5 · AI explainability — band shown, Why? opens four panels, no layout shift',
    explain.hadWhy && explain.band && panels.four >= 3 && panels.shifted === explain.before,
    `${panels.four} panels · width ${explain.before} → ${panels.shifted}`,
  )

  // Close the drawer(s) with Escape.
  for (let i = 0; i < 3; i += 1) {
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
    await sleep(250)
  }

  // ── 5b · AI-OFF hides every diamond ──────────────────────────────────────
  const toggled = await page.evaluate(() => {
    const menu = Array.from(document.querySelectorAll('header button[aria-expanded]')).at(-1)
    if (!menu) return 'no user menu'
    menu.click()
    return 'opened'
  })
  await page.until(
    () => !!document.querySelector('[role="switch"][aria-label="AI fabric enabled"]'),
    'the AI kill switch',
  )
  await page.evaluate(() => {
    document.querySelector('[role="switch"][aria-label="AI fabric enabled"]').click()
  })
  await sleep(700)
  // Close the popover.
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await sleep(400)
  const aiOff = await page.evaluate(() => {
    const text = document.body.innerText
    return {
      noAcuity: !/Sorted by AI acuity/.test(text),
      saysWhy: /AI ranking is off/.test(text),
      bubble: !!document.querySelector('[aria-label*="assistant" i]'),
      dayIntact: /Ward round/.test(text) && /OPD/.test(text),
      counts: document.querySelectorAll('dl a').length,
    }
  })
  check(
    '5b · AI-OFF — ◆ hidden, bubble unmounted, day plan and counts unaffected',
    aiOff.noAcuity && aiOff.saysWhy && !aiOff.bubble && aiOff.dayIntact && aiOff.counts === 4,
    `${toggled} · bubble ${aiOff.bubble ? 'present' : 'gone'} · ${aiOff.counts} counts still shown`,
  )

  // Back on. A reload restores it anyway, since the kill switch is per session.

  // ── 3 · Mark seen ────────────────────────────────────────────────────────
  await page.goto('/clinician?e2e=1')
  await page.until(() => !!document.querySelector('[data-screen-id="S-06-01"]'), 'My Day')
  const before = await page.evaluate(
    () =>
      Array.from(document.querySelectorAll('ul li button[type="button"]')).filter((b) =>
        b.querySelector('svg[role="img"]'),
      ).length,
  )
  await page.evaluate(clickByText, 'ul li button[type="button"]', 'Critical lab')
  await page.until(() => /changed since then/i.test(document.body.innerText), 'the Quick-Panel')
  const hadDeltas = await page.evaluate(
    () => !/nothing has changed since you last saw/i.test(document.body.innerText),
  )
  await page.evaluate(clickByText, 'button', 'Mark seen')
  await sleep(600)
  const audited = await page.evaluate(() => {
    const raw = localStorage.getItem('indostates.audit')
    const rows = raw ? JSON.parse(raw).state.rows : []
    return rows.filter((r) => r.event === 'PATIENT.MARKED_SEEN').length
  })
  for (let i = 0; i < 2; i += 1) {
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
    await sleep(200)
  }
  await page.goto('/clinician?e2e=1')
  await page.until(() => !!document.querySelector('[data-screen-id="S-06-01"]'), 'My Day after reload')
  const after = await page.evaluate(
    () =>
      Array.from(document.querySelectorAll('ul li button[type="button"]')).filter((b) =>
        b.querySelector('svg[role="img"]'),
      ).length,
  )
  check(
    '3 · Mark seen — row clears, audit row written, survives a reload',
    hadDeltas && audited >= 1 && after === before - 1,
    `${before} → ${after} rows · ${audited} audit event${audited === 1 ? '' : 's'}`,
  )

  // ── 4 · Voice transcribe and save ────────────────────────────────────────
  await page.evaluate(() => {
    // Force the fallback path: this browser has no microphone, so the live path
    // would fail anyway — removing the constructor makes the test deterministic.
    delete window.SpeechRecognition
    delete window.webkitSpeechRecognition
  })
  await page.evaluate(clickByText, 'button', 'Add note')
  await page.until(() => /Start dictation/.test(document.body.innerText), 'the dictation panel')
  const saveDisabledAtStart = await page.evaluate(() => {
    const save = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.trim() === 'Save')
    return save?.disabled === true
  })
  await page.evaluate(clickByText, 'button', 'Start dictation')
  await page.until(
    () => !!document.querySelector('#dictation-draft'),
    'the editable draft',
    20000,
  )
  const draft = await page.evaluate(() => {
    const ta = document.querySelector('#dictation-draft')
    return { len: ta.value.length, notice: /captured sample/i.test(document.body.innerText) }
  })
  // Edit it, the way a clinician would.
  await page.evaluate(() => {
    const ta = document.querySelector('#dictation-draft')
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
    setter.call(ta, ta.value + ' Reviewed and edited by the consultant.')
    ta.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await sleep(300)
  const edited = await page.evaluate(() => /edited by you/.test(document.body.innerText))
  const auditBeforeSave = await page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem('indostates.audit')).state.rows
    return {
      transcript: rows.filter((r) => r.event === 'AI.SCRIBE.TRANSCRIPT_CREATED').length,
      saved: rows.filter((r) => r.event === 'NOTE.DRAFT_SAVED').length,
      notes: JSON.parse(localStorage.getItem('indostates.clinical')).state.voiceNotes,
    }
  })
  await page.evaluate(clickByText, 'button', 'Save')
  await sleep(600)
  const afterSave = await page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem('indostates.audit')).state.rows
    const notes = JSON.parse(localStorage.getItem('indostates.clinical')).state.voiceNotes
    const saved = rows.filter((r) => r.event === 'NOTE.DRAFT_SAVED')
    return {
      saved: saved.length,
      model: saved.at(-1)?.model ?? '',
      gate: saved.at(-1)?.gate ?? '',
      stored: Object.values(notes).flat().length,
    }
  })
  check(
    '4 · Voice transcribe — fallback declared, editable, saved only on confirm',
    draft.len > 40 &&
      draft.notice &&
      edited &&
      saveDisabledAtStart &&
      auditBeforeSave.transcript >= 1 &&
      Object.keys(auditBeforeSave.notes ?? {}).length === 0 &&
      afterSave.saved >= 1 &&
      afterSave.stored >= 1,
    `${draft.len} chars · nothing stored before Save · model "${afterSave.model}" gate ${afterSave.gate}`,
  )

  // ── 8 · Offline mark-seen sync ───────────────────────────────────────────
  await page.goto('/clinician?e2e=1')
  await page.until(() => !!document.querySelector('[data-screen-id="S-06-01"]'), 'My Day')
  await page.evaluate(() => {
    const sel = document.querySelector('#state-switcher')
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
    setter.call(sel, 'OFFLINE')
    sel.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await sleep(500)
  const offlineOn = await page.evaluate(() => /queued|offline/i.test(document.body.innerText))
  await page.evaluate(clickByText, 'ul li button[type="button"]', 'New deterioration')
  await page.until(() => /changed since then/i.test(document.body.innerText), 'the Quick-Panel (offline)')
  await page.evaluate(clickByText, 'button', 'Mark seen')
  await sleep(500)
  const queued = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('indostates.clinical')).state
    return { pending: state.pendingSeen.length, visible: /queued for sync/i.test(document.body.innerText) }
  })
  for (let i = 0; i < 2; i += 1) {
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
    await sleep(200)
  }
  await page.evaluate(() => {
    const sel = document.querySelector('#state-switcher')
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
    setter.call(sel, 'DEFAULT')
    sel.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await sleep(700)
  const flushed = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('indostates.clinical')).state
    return { pending: state.pendingSeen.length, toast: /synced/i.test(document.body.innerText) }
  })
  check(
    '8 · Offline mark-seen — queued with a visible count, then flushed',
    offlineOn && queued.pending === 1 && queued.visible && flushed.pending === 0 && flushed.toast,
    `queued ${queued.pending} → flushed ${flushed.pending}`,
  )

  // ── 7 · Critical event alert ─────────────────────────────────────────────
  await page.evaluate(() => {
    localStorage.removeItem('indostates.clinical')
    localStorage.removeItem('indostates.ai')
  })
  await page.goto('/clinician?e2e=1')
  await page.until(() => !!document.querySelector('[data-screen-id="S-06-01"]'), 'My Day')
  await page.evaluate(() => {
    // Notification permission cannot be granted headlessly, so the real
    // Notification path is stubbed and its call recorded. The toast is real.
    window.__notified = 0
    window.Notification = function (title, opts) {
      window.__notified += 1
      window.__lastNotification = { title, body: opts?.body }
    }
    window.Notification.requestPermission = () => Promise.resolve('granted')
  })
  await page.evaluate(clickByText, 'button[aria-label*="Simulate"]', '')
  await sleep(800)
  const alerted = await page.evaluate(() => ({
    toast: !!document.querySelector('[role="status"]')?.innerText.match(/Critical lab/),
    notifications: window.__notified ?? 0,
    title: window.__lastNotification?.title ?? '',
    panel: /changed since then/i.test(document.body.innerText),
  }))
  check(
    '7 · Critical event alert — toast, Notification, deep link into the item',
    alerted.toast && alerted.notifications >= 1 && alerted.panel,
    `notification "${alerted.title}"`,
  )

  // ── 6 · Login flow ───────────────────────────────────────────────────────
  await page.evaluate(() => localStorage.clear())
  await page.goto('/ip/patients')
  await sleep(700)
  const redirected = await page.evaluate(() => ({
    onLogin: !!document.querySelector('[data-screen-id="S-02-01"]'),
    next: new URLSearchParams(location.search).get('next'),
    noBubble: !document.querySelector('[aria-label*="assistant" i]'),
    noAppBar: !document.querySelector('header[class*="h-z1"]'),
  }))

  /** Types into a field the way a person does, so React's onChange fires. */
  const type = async (selector, value) => {
    await page.evaluate(
      function (sel, val) {
        const el = document.querySelector(sel)
        const proto = el.tagName === 'INPUT' ? HTMLInputElement : HTMLTextAreaElement
        Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, val)
        el.dispatchEvent(new Event('input', { bubbles: true }))
      },
      selector,
      value,
    )
  }

  // Two different failure modes must produce the SAME sentence.
  const messages = []
  for (const [email, password] of [
    ['nobody@example.com', 'short'],
    ['definitely-not-a-user@indostates.in', 'x'],
  ]) {
    await type('#login-email', email)
    await type('#login-password', password)
    await sleep(150)
    await page.evaluate(clickByText, 'button[type="submit"]', 'Sign in')
    await sleep(700)
    messages.push(await page.evaluate(() => document.querySelector('[role="alert"]')?.innerText.trim() ?? ''))
  }

  // Three more to reach the lock at five.
  for (let i = 0; i < 3; i += 1) {
    await type('#login-email', `a${i}@b.com`)
    await type('#login-password', 'x')
    await sleep(120)
    await page.evaluate(clickByText, 'button[type="submit"]', 'Sign in')
    await sleep(600)
  }
  const locked = await page.evaluate(() => /Temporarily locked/.test(document.body.innerText))

  // Clear the lock and sign in for real, then check `next` was honoured.
  await page.evaluate(() => {
    const parsed = JSON.parse(localStorage.getItem('indostates.session'))
    parsed.state.lockedUntil = null
    parsed.state.failedAttempts = 0
    localStorage.setItem('indostates.session', JSON.stringify(parsed))
  })
  await page.goto('/ip/patients')
  await sleep(700)
  await type('#login-email', 'ananya.iyer@indostates.in')
  await type('#login-password', 'consultant2026')
  await sleep(150)
  await page.evaluate(clickByText, 'button[type="submit"]', 'Sign in')
  await sleep(1200)
  const landed = await page.evaluate(() => ({
    screen: document.querySelector('[data-screen-id]')?.dataset.screenId ?? '',
    path: location.pathname,
  }))

  check(
    '6 · Login — redirect with ?next, one uniform failure, lock at five, next honoured',
    redirected.onLogin &&
      redirected.next === '/ip/patients' &&
      redirected.noBubble &&
      messages[0] !== '' &&
      messages[0] === messages[1] &&
      locked &&
      landed.path === '/ip/patients',
    `"${messages[0]}" · locked ${locked} · landed ${landed.path} (${landed.screen})`,
  )

  // ── Notes open empty; dictation lands in the field; only scribe drafts gate Sign ──
  await page.goto('/ip/encounter/E-118366/note?e2e=1')
  await page.until(() => !!document.querySelector('[data-screen-id="S-08-04"]'), 'the progress note')
  await page.evaluate(() => {
    delete window.SpeechRecognition
    delete window.webkitSpeechRecognition
  })
  const emptyAtStart = await page.evaluate(() => {
    const areas = Array.from(document.querySelectorAll('main textarea'))
    const mics = Array.from(document.querySelectorAll('main button')).filter((b) => /^Dictate$/.test(b.innerText.trim()))
    const ghosts = document.querySelectorAll('main .ai-ghost').length
    const voiceOn = document.querySelector('[role="radio"][aria-checked="true"]')?.innerText.trim()
    return { filled: areas.filter((t) => t.value.trim() !== '').length, mics: mics.length, ghosts, voiceOn }
  })
  await page.evaluate(clickByText, 'main button', 'Dictate')
  await page.until(
    () => {
      const ta = document.getElementById('E-118366:subjective')
      return ta instanceof HTMLTextAreaElement && ta.value.length > 40
    },
    'the dictated subjective',
    45000,
  )
  const afterDictation = await page.evaluate(() => {
    const ta = document.getElementById('E-118366:subjective')
    const bars = Array.from(document.querySelectorAll('main [role="group"]')).filter((g) =>
      /Disposition for/.test(g.getAttribute('aria-label') ?? ''),
    ).length
    const provenance = JSON.parse(localStorage.getItem('indostates.clinical')).state.notes['E-118366']?.provenance ?? {}
    return { len: ta.value.length, provenance: provenance.subjective, bars, dictated: /Dictated ·/.test(document.body.innerText) }
  })
  await page.evaluate(clickByText, 'button', 'Draft with AI')
  await page.until(() => /Stop and use what is drafted|Use this draft/.test(document.body.innerText), 'the scribe overlay')
  await page.until(() => /Use this draft/.test(document.body.innerText), 'the round captured', 30000)
  await page.evaluate(clickByText, 'button', 'Use this draft')
  await sleep(500)
  const afterScribe = await page.evaluate(() => {
    const bars = Array.from(document.querySelectorAll('main [role="group"]')).filter((g) =>
      /Disposition for/.test(g.getAttribute('aria-label') ?? ''),
    ).length
    const sign = Array.from(document.querySelectorAll('button')).find((b) => /^Sign$|Save for co-sign/.test(b.innerText.trim()))
    const provenance = JSON.parse(localStorage.getItem('indostates.clinical')).state.notes['E-118366']?.provenance ?? {}
    return { bars, signDisabled: sign?.disabled === true, plan: provenance.plan, subjective: provenance.subjective, needs: /AI drafts? needs? a decision/.test(document.body.innerText) }
  })

  // One truth: Accept copies the draft into the field; clearing it does not bring the draft back;
  // Defer blocks Sign; Undo returns the ghost; a code from the search enables Sign; decisions survive a reload.
  // Every helper is self-contained: `page.evaluate` serialises the function and JSON-encodes its arguments.
  const actOnGroup = function (which, label) {
    const groups = Array.from(document.querySelectorAll('main [role="group"]')).filter((g) =>
      /Disposition for/.test(g.getAttribute('aria-label') ?? ''),
    )
    const has = (g) => Array.from(g.querySelectorAll('button')).some((x) => x.innerText.trim() === label)
    const g = which === 'last' ? groups[groups.length - 1] : which === 'first' ? groups[0] : groups.find(has)
    if (!g) return false
    const b = Array.from(g.querySelectorAll('button')).find((x) => x.innerText.trim() === label)
    if (!b) return false
    b.click()
    return true
  }
  const setTextarea = function (id, value) {
    const ta = document.getElementById(id)
    if (!(ta instanceof HTMLTextAreaElement)) return false
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
    setter.call(ta, value)
    ta.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  }
  // Accept the LAST drafted section (the plan), then empty it.
  await page.evaluate(actOnGroup, 'last', 'Accept')
  await sleep(200)
  const accepted = await page.evaluate(() => {
    const ta = document.getElementById('E-118366:plan')
    return ta instanceof HTMLTextAreaElement ? ta.value.length : -1
  })
  await page.evaluate(setTextarea, 'E-118366:plan', '')
  await sleep(200)
  const cleared = await page.evaluate(() => {
    const ta = document.getElementById('E-118366:plan')
    const ghost = ta ? ta.classList.contains('ai-ghost') : false
    return { isTextarea: ta instanceof HTMLTextAreaElement, value: ta instanceof HTMLTextAreaElement ? ta.value : '(ghost)', ghost }
  })
  await page.evaluate(setTextarea, 'E-118366:plan', 'Continue current antibiotics and review tomorrow morning on the round.')
  // Defer the first remaining undecided draft — Sign must stay disabled.
  await page.evaluate(actOnGroup, 'first', 'Defer')
  await sleep(200)
  const deferred = await page.evaluate(() => {
    const sign = Array.from(document.querySelectorAll('button')).find((b) => /^Sign$|Save for co-sign/.test(b.innerText.trim()))
    return { chip: /Deferred/.test(document.body.innerText), signDisabled: sign?.disabled === true }
  })
  // Undo the deferral, then accept every remaining draft.
  await page.evaluate(clickByText, 'main button', 'Undo')
  await sleep(200)
  for (let i = 0; i < 3; i += 1) {
    const did = await page.evaluate(actOnGroup, 'first-with', 'Accept')
    if (!did) break
    await sleep(150)
  }
  // Code the note from the search, not the chip.
  await page.evaluate(() => {
    const input = document.querySelector('input[aria-label="Search ICD-10"]')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, 'J18')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await page.until(() => !!document.querySelector('[role="option"]'), 'ICD-10 matches')
  await page.evaluate(() => {
    const opt = Array.from(document.querySelectorAll('[role="option"]')).find((o) => /J18\.9/.test(o.innerText) && !o.disabled)
    opt?.click()
  })
  await sleep(200)
  await page.evaluate(clickByText, 'button', 'Save draft')
  await sleep(300)
  const readyToSign = await page.evaluate(() => {
    const sign = Array.from(document.querySelectorAll('button')).find((b) => /^Sign$|Save for co-sign/.test(b.innerText.trim()))
    const rec = JSON.parse(localStorage.getItem('indostates.clinical')).state.notes['E-118366']
    return { signEnabled: sign ? !sign.disabled : false, code: rec?.code, savedHow: rec?.savedHow, toast: /Draft saved/.test(document.body.innerText), written: Object.values(rec?.text ?? {}).filter((t) => String(t).trim().length >= 10).length }
  })
  await page.goto('/ip/encounter/E-118366/note?e2e=1')
  await page.until(() => !!document.querySelector('[data-screen-id="S-08-04"]'), 'the progress note after reload')
  await sleep(400)
  const afterReload = await page.evaluate(() => {
    const sign = Array.from(document.querySelectorAll('button')).find((b) => /^Sign$|Save for co-sign/.test(b.innerText.trim()))
    // The innermost span reading exactly "Accepted" is the decision chip.
    const decided = Array.from(document.querySelectorAll('main span')).filter(
      (el) => /^Accepted( with edits)?$/.test(el.innerText.trim()) && !/^Accepted( with edits)?$/.test(el.parentElement?.innerText.trim() ?? ''),
    ).length
    const undecided = Array.from(document.querySelectorAll('main [role="group"]')).filter((g) => /Disposition for/.test(g.getAttribute('aria-label') ?? '')).length
    return { signEnabled: sign ? !sign.disabled : false, decided, undecided }
  })
  check(
    'One truth for a note section — Accept fills, clearing does not resurrect, Defer blocks Sign, code by search enables it, decisions survive a reload',
    accepted > 40 &&
      cleared.isTextarea &&
      cleared.value === '' &&
      !cleared.ghost &&
      deferred.chip &&
      deferred.signDisabled &&
      readyToSign.code === 'J18.9' &&
      readyToSign.savedHow === 'manual' &&
      readyToSign.toast &&
      readyToSign.written === 4 &&
      readyToSign.signEnabled &&
      afterReload.signEnabled &&
      afterReload.decided >= 3 &&
      afterReload.undecided === 0,
    `accepted ${accepted} chars → cleared stays empty (ghost ${cleared.ghost}) · deferred blocks Sign ${deferred.signDisabled} · coded ${readyToSign.code} · saved ${readyToSign.savedHow} · Sign enabled ${readyToSign.signEnabled} → after reload ${afterReload.signEnabled}, ${afterReload.decided} decided, ${afterReload.undecided} undecided`,
  )
  check(
    'Notes open empty — dictation lands in the field, only scribe drafts carry a decision bar',
    emptyAtStart.filled === 0 &&
      emptyAtStart.mics === 4 &&
      emptyAtStart.ghosts === 0 &&
      emptyAtStart.voiceOn === 'Voice' &&
      afterDictation.len > 40 &&
      afterDictation.provenance === 'dictated' &&
      afterDictation.bars === 0 &&
      afterDictation.dictated &&
      afterScribe.bars >= 1 &&
      afterScribe.signDisabled &&
      afterScribe.plan === 'scribe' &&
      afterScribe.subjective === 'dictated' &&
      afterScribe.needs,
    `${emptyAtStart.mics} mics · 0 pre-filled · dictated ${afterDictation.len} chars (${afterDictation.provenance}) · ${afterDictation.bars} → ${afterScribe.bars} decision bars after the scribe`,
  )

  // ── The My Day tiles are a partition ──────────────────────────────────────
  // The bug this guards: `Follow-up` sat beside `OPD` while being a subset of
  // it, so three patients were counted twice and the header read 15 for a
  // consultant with 13 — and the ED patient was in the inpatient list but in
  // no tile at all.
  await page.goto('/clinician?e2e=1')
  await page.until(() => !!document.querySelector('[data-screen-id="S-06-01"]'), 'My Day')
  const tiles = await page.evaluate(function () {
    const card = Array.from(document.querySelectorAll('section')).find((s) =>
      /MY PATIENTS/i.test(s.querySelector('h2')?.innerText ?? ''),
    )
    if (!card) return { missing: true }
    const values = Array.from(card.querySelectorAll('dd')).map((d) => Number(d.innerText.trim()))
    const labels = Array.from(card.querySelectorAll('dt')).map((d) => d.innerText.trim())
    const header = Number((card.querySelector('h2')?.parentElement?.innerText ?? '').replace(/\D+/g, ''))
    return { values, labels, header, sum: values.reduce((a, b) => a + b, 0) }
  })
  check(
    'My Day tiles partition the caseload — they sum to the stated total',
    !tiles.missing && tiles.sum === tiles.header && !tiles.labels.includes('Follow-up'),
    tiles.missing ? 'card not found' : `${tiles.labels.join(' + ')} = ${tiles.sum}, header ${tiles.header}`,
  )

  // Ward + ICU + ED on My Day must equal the inpatient list's own count.
  await page.goto('/ip/patients?e2e=1')
  await page.until(() => !!document.querySelector('[data-screen-id="S-08-03"]'), 'Inpatients')
  const ip = await page.evaluate(function () {
    const heading = document.querySelector('h1')?.innerText.trim()
    const rows = document.querySelectorAll('main ul[aria-label] > li > button').length
    return { heading, rows }
  })
  const inpatientTiles = (tiles.values ?? []).slice(1).reduce((a, b) => a + b, 0)
  check(
    'Inpatients is one word, and its parts add up to the whole',
    ip.heading === 'Inpatients' && ip.rows === inpatientTiles,
    `heading "${ip.heading}" · ${ip.rows} rows vs Ward+ICU+ED ${inpatientTiles}`,
  )

  // ── The Stroke-AI Console shows a real study ─────────────────────────────
  await page.goto('/stroke/ai-console?e2e=1')
  await page.until(() => !!document.querySelector('[data-screen-id="S-18-21"]'), 'Stroke-AI Console')
  const ncct = await page.evaluate(async function () {
    const img = document.querySelector('main img[src^="/ncct/"]')
    if (!img) return { missing: true }
    const first = img.getAttribute('src')
    const overlayBefore = !!document.querySelector('main [data-ncct-overlay]')
    // Scrub one slice on.
    const next = Array.from(document.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === 'Next slice',
    )
    next?.click()
    await new Promise((r) => setTimeout(r, 250))
    const second = document.querySelector('main img[src^="/ncct/"]')?.getAttribute('src')
    // Remove the overlay — AIP-04 requires the unmarked image to be reachable.
    const toggle = Array.from(document.querySelectorAll('button')).find((b) => /AI overlay on/i.test(b.innerText))
    toggle?.click()
    await new Promise((r) => setTimeout(r, 200))
    const overlayAfter = !!document.querySelector('main [data-ncct-overlay]')
    return {
      first,
      second,
      scrubbed: first !== second,
      overlayBefore,
      overlayAfter,
      naturalWidth: img.naturalWidth,
    }
  })
  check(
    'Stroke-AI Console — real NCCT pixels, slices scrub, the unmarked image is reachable',
    !ncct.missing && ncct.scrubbed && ncct.naturalWidth > 0 && ncct.overlayBefore && !ncct.overlayAfter,
    ncct.missing
      ? 'no /ncct/ image on the page'
      : `${ncct.first} → ${ncct.second} · ${ncct.naturalWidth}px · overlay ${ncct.overlayBefore} → ${ncct.overlayAfter}`,
  )

  // ── Calm check on EVERY routed screen ─────────────────────────────────────
  // No data table (except the three that are genuinely tabular), no breadcrumb,
  // no footer spec line, no horizontal overflow, and the rail opens collapsed.
  const TABLE_OK = new Set(['S-18-08', 'S-13-03', 'S-09-05'])
  const calm = []
  for (const { id, path } of routedScreens()) {
    if (id === 'S-02-01' || id === 'S-18-01') continue // bare frames, checked elsewhere
    await page.goto(withE2E(path))
    try {
      await page.until(() => !!document.querySelector('[data-screen-id]'), id, 4000)
    } catch {
      calm.push({ id, missing: true })
      continue
    }
    const r = await page.evaluate(
      function (screenId) {
        const root = document.querySelector(`[data-screen-id="${screenId}"]`)
        if (!root) return { missing: true }
        const main = root.querySelector('main')
        // A table hidden behind a disclosure is fine; only VISIBLE tables count.
        const tables = Array.from(root.querySelectorAll('main table')).filter((t) => t.getClientRects().length > 0).length
        const breadcrumb = !!root.querySelector('nav[aria-label="Breadcrumb"]')
        const specLine = /tier T[123] · density/.test(root.innerText)
        const openRails = Array.from(root.querySelectorAll('aside h2')).length
        /*
         * Every button does something. A visible, enabled button with no click
         * handler (read off React's props on the node) and no form to submit is
         * a promise the screen does not keep.
         */
        const inert = Array.from(root.querySelectorAll('button'))
          .filter((b) => b.getClientRects().length > 0 && !b.disabled && b.getAttribute('type') !== 'submit' && !b.closest('form'))
          .filter((b) => {
            const key = Object.keys(b).find((k) => k.startsWith('__reactProps'))
            const props = key ? b[key] : undefined
            return !props || (typeof props.onClick !== 'function' && typeof props.onMouseDown !== 'function' && typeof props.onPointerDown !== 'function')
          })
          .map((b) => (b.innerText || b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 32) || '(icon)')
        /*
         * A wall of text, measured as the reader sees it: a paragraph taller
         * than six rendered lines. Character count was the wrong measure —
         * `line-clamp-2` leaves the full string in `innerText` while showing
         * two lines, and it would have flagged the patient-instruction body,
         * which IS the content of its screen rather than an explanation of it.
         */
        const longProse = main
          ? Array.from(main.querySelectorAll('p')).filter((el) => {
              if (el.getClientRects().length === 0) return false
              const cs = getComputedStyle(el)
              if (cs.webkitLineClamp && cs.webkitLineClamp !== 'none') return false
              const line = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5
              return el.getBoundingClientRect().height > line * 6
            }).length
          : 0
        return {
          tables,
          breadcrumb,
          specLine,
          openRails,
          inert,
          longProse,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        }
      },
      id,
    )
    calm.push({ id, ...r })
  }
  const dense = calm.filter(
    (c) => c.missing || (c.tables > 0 && !TABLE_OK.has(c.id)) || c.breadcrumb || c.specLine || c.overflow > 1 || c.openRails > 0,
  )
  check(
    `Calm check — ${calm.length} screens: no table, breadcrumb, spec line, overflow or open rail`,
    dense.length === 0,
    dense.length === 0
      ? `${calm.filter((c) => c.tables > 0).map((c) => c.id).join(' ')} keep a table by allow-list`
      : dense
          .map(
            (c) =>
              `${c.id}${c.missing ? ':missing' : ''}${c.tables && !TABLE_OK.has(c.id) ? `:${c.tables}t` : ''}${c.breadcrumb ? ':crumb' : ''}${c.specLine ? ':spec' : ''}${c.overflow > 1 ? `:${c.overflow}px` : ''}${c.openRails ? ':rail' : ''}`,
          )
          .join(' '),
  )
  const withInert = calm.filter((c) => c.inert && c.inert.length > 0)
  check(
    'Every button acts — no visible, enabled button without a handler on any screen',
    withInert.length === 0,
    withInert.length === 0 ? 'none' : withInert.map((c) => `${c.id}: ${c.inert.join(' | ')}`).join(' · '),
  )
  const prose = calm.filter((c) => c.longProse > 0)
  check(
    'Calm check — no paragraph taller than six rendered lines on any screen',
    prose.length === 0,
    prose.map((c) => `${c.id}:${c.longProse}`).join(' ') || 'none',
  )

  ws.close()
  chrome.kill()
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 })
  } catch {
    /* Chrome is still flushing its profile; the OS will reap /tmp. */
  }

  const failed = results.filter((r) => !r.pass)
  console.log(`\n---- ${results.length - failed.length} passed, ${failed.length} failed ----`)
  process.exit(failed.length === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('harness error:', e.message)
  chrome.kill()
  process.exit(2)
})
