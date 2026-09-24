/**
 * Text-contrast audit across the redesigned screens, in both themes.
 *
 * Method: MEASURED ON RENDERED PIXELS. The page is screenshotted through the
 * DevTools Protocol, the PNG is handed back into the page as a data URL, drawn
 * to a canvas, and each text element's background is the MODAL pixel inside its
 * box — text covers a minority of the box, so the mode is the background, and
 * antialiased glyph edges cannot skew it. That captures the page gradient, the
 * two blurred blooms and every stacked `backdrop-filter`, none of which can be
 * derived from `getComputedStyle`.
 *
 * An earlier version of this script composited ancestor `background-color`s over
 * `body`'s own colour instead. That reported ~40 false failures, because a Z4
 * header has no background of its own and the model therefore put its text on
 * `--color-page-to` — the DARKEST stop of a gradient whose light stops are what
 * actually renders there.
 *
 * AA for body text is 4.5:1. Text at >=18.66px bold or >=24px needs 3:1, and
 * the report applies that threshold where it holds.
 *
 * Usage:  npm run dev   # in another terminal
 *         node scripts/contrast.mjs
 */

import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { routedScreens, withE2E } from './routes.mjs'

const BASE = process.env.BASE ?? 'http://localhost:5180'
const PORT = 9355
const profile = mkdtempSync(join(tmpdir(), 'contrast-'))
const chrome = spawn(
  process.env.CHROME ?? 'google-chrome',
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--window-size=1440,1200',
    'about:blank',
  ],
  { stdio: 'ignore' },
)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function target() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const pages = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).filter(
        (p) => p.type === 'page',
      )
      if (pages[0]) return pages[0].webSocketDebuggerUrl
    } catch {
      /* not up */
    }
    await sleep(250)
  }
  throw new Error('no debugging target')
}

const ws = new WebSocket(await target())
await new Promise((r) => ws.addEventListener('open', r))
let seq = 0
const pending = new Map()
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  const p = pending.get(m.id)
  if (p) {
    pending.delete(m.id)
    m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result)
  }
})
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
const evaluate = async (expression) => {
  const { result, exceptionDetails } = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description)
  return result.value
}

await send('Page.enable')
await send('Runtime.enable')

const AUDIT = `
(async () => {
  const parse = (c) => {
    const m = c.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const [r, g, b, a] = m[1].split(/[,\\s/]+/).filter(Boolean).map(Number);
    return { r, g, b, a: a === undefined ? 1 : a };
  };
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
  const ratio = (a, b) => {
    const la = lum(a), lb = lum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };

  // The rendered page, as pixels.
  const img = new Image();
  img.src = window.__shot;
  await img.decode();
  const cv = document.createElement('canvas');
  cv.width = img.naturalWidth;
  cv.height = img.naturalHeight;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const scale = img.naturalWidth / window.innerWidth;

  /**
   * The modal pixel inside the box, EXCLUDING pixels close to the text colour.
   *
   * Without that exclusion a small solid control breaks the method: on a button
   * the glyphs can occupy more of the box than the fill, so the mode is the
   * text itself and the ratio comes back 1.0. Dropping near-foreground pixels
   * leaves the background as the mode whatever the glyph density.
   */
  const sampledBg = (r, fg) => {
    const x0 = Math.max(0, Math.round(r.left * scale));
    const y0 = Math.max(0, Math.round(r.top * scale));
    const w = Math.min(cv.width - x0, Math.round(r.width * scale));
    const h = Math.min(cv.height - y0, Math.round(r.height * scale));
    if (w < 2 || h < 2) return null;
    const data = ctx.getImageData(x0, y0, w, h).data;
    const counts = new Map();
    const near = (i) =>
      fg && Math.abs(data[i] - fg.r) < 40 && Math.abs(data[i + 1] - fg.g) < 40 && Math.abs(data[i + 2] - fg.b) < 40;
    for (let i = 0; i < data.length; i += 4) {
      if (near(i)) continue;
      // Quantise to 4 levels per channel so antialiasing does not fragment the mode.
      const key = ((data[i] >> 2) << 12) | ((data[i + 1] >> 2) << 6) | (data[i + 2] >> 2);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    if (counts.size === 0) return null;
    let best = null;
    let bestN = 0;
    for (const [k, n] of counts) {
      if (n > bestN) {
        bestN = n;
        best = k;
      }
    }
    // Recover the mean of the winning bucket, for precision.
    let sr = 0, sg = 0, sb = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (near(i)) continue;
      const key = ((data[i] >> 2) << 12) | ((data[i + 1] >> 2) << 6) | (data[i + 2] >> 2);
      if (key === best) { sr += data[i]; sg += data[i + 1]; sb += data[i + 2]; n += 1; }
    }
    if (n === 0) return null;
    return { r: sr / n, g: sg / n, b: sb / n, a: 1 };
  };

  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    // Only elements with their own visible text run.
    const own = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(' ')
      .trim();
    if (own.length < 2) continue;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) < 0.3) continue;
    // WCAG 1.4.3 exempts text that is part of an INACTIVE control.
    if (el.closest('[disabled], [aria-disabled="true"]')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;

    const fg = parse(s.color);
    if (!fg) continue;
    if (r.top < 0 || r.bottom > window.innerHeight || r.right > window.innerWidth) continue;
    /*
     * Prefer a real opaque background where the element or an ancestor
     * declares one. The modal-pixel method is right for glass over a gradient,
     * but WRONG for a small solid control: on a button the glyphs can occupy
     * more of the box than the fill, so the mode IS the text and the ratio
     * comes back ~1.0. That produced ~90 phantom failures on labels like
     * "Accept" and "Save draft" that are in fact white on a solid brand fill.
     */
    let bg = null;
    for (let node = el; node && node !== document.documentElement; node = node.parentElement) {
      const ns = getComputedStyle(node);
      // A gradient or image fill has no single colour to declare — the pixels
      // are the answer. Without this the walk skipped an AI-indigo gradient
      // button straight to body's pale colour and reported white-on-pale.
      if (ns.backgroundImage && ns.backgroundImage !== 'none') break;
      const c = parse(ns.backgroundColor);
      if (c && c.a >= 0.99) { bg = c; break; }
      if (c && c.a > 0) break; // translucent: the pixels are the honest answer
    }
    if (!bg) bg = sampledBg(r, fg);
    if (!bg) continue;
    const size = parseFloat(s.fontSize);
    const weight = Number(s.fontWeight) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    const got = ratio(over(fg, bg), bg);
    out.push({
      text: own.slice(0, 44),
      cls: (el.className || '').toString().slice(0, 48),
      size: Math.round(size * 10) / 10,
      weight,
      large,
      need,
      got: Math.round(got * 100) / 100,
      pass: got >= need - 0.005,
    });
  }
  out.sort((a, b) => a.got - b.got);
  return { total: out.length, worst: out.slice(0, 6), failures: out.filter((o) => !o.pass) };
})()
`

/**
 * Every routed screen, both themes. The login route is walked without the
 * e2e seed (it would redirect a signed-in session away). `ONLY=S-13-01,S-18-20`
 * narrows the run while iterating on one screen.
 */
const only = process.env.ONLY?.split(',').map((s) => s.trim())
const SCREENS = routedScreens()
  .filter((s) => !only || only.includes(s.id))
  .map((s) => [s.id, s.path])

let bad = 0
for (const theme of ['light', 'night']) {
  console.log(`\n=== ${theme.toUpperCase()} ===`)
  for (const [id, path] of SCREENS) {
    await send('Page.navigate', { url: `${BASE}${id === 'S-02-01' ? path : withE2E(path)}` })
    await sleep(1000)
    /*
     * The persisted session carries `version: 2` (night default, Coimbatore
     * hub); writing a lower version would run the store's migration on reload
     * and flip the theme back to night under a light-theme pass. A page that
     * has not finished loading denies localStorage — retry rather than abort.
     */
    const seed = `
      (() => {
        const KEY = 'indostates.session';
        const p = JSON.parse(localStorage.getItem(KEY) || '{}');
        p.state = { ...(p.state || {}), theme: '${theme}', signedIn: ${JSON.stringify(id !== 'S-02-01')} };
        p.version = Math.max(p.version ?? 0, 2);
        localStorage.setItem(KEY, JSON.stringify(p));
      })()
    `
    for (let attempt = 0; ; attempt += 1) {
      try {
        await evaluate(seed)
        break
      } catch (e) {
        if (attempt >= 3) throw e
        await sleep(1500)
      }
    }
    await send('Page.reload')
    /*
     * Long enough for the theme, the fonts and the glass to settle. At 1200 ms
     * the screenshot sometimes caught a page mid-paint — pale pixels behind
     * night-theme text — and reported ~50 phantom night failures whose computed
     * colours measure comfortably over 4.5:1.
     */
    await sleep(2600)
    await evaluate('document.fonts.ready')
    const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    await evaluate(`window.__shot = 'data:image/png;base64,${data}'`)
    const r = await evaluate(AUDIT)
    const worst = r.worst[0]
    const fails = r.failures.filter((f) => f.got < f.need - 0.05)
    bad += fails.length
    console.log(
      `${fails.length === 0 ? 'PASS' : 'FAIL'}  ${id.padEnd(8)} ${String(r.total).padStart(3)} text runs · worst ${worst?.got}:1 (needs ${worst?.need}) "${worst?.text}"`,
    )
    for (const f of fails.slice(0, 5)) {
      console.log(`        ${f.got}:1 need ${f.need} · ${f.size}px/${f.weight} · "${f.text}" · ${f.cls}`)
    }
  }
}

// Leave the theme as the product default.
await evaluate(`
  (() => {
    const KEY = 'indostates.session';
    const p = JSON.parse(localStorage.getItem(KEY) || '{}');
    p.state = { ...(p.state || {}), theme: 'night' };
    p.version = Math.max(p.version ?? 0, 2);
    localStorage.setItem(KEY, JSON.stringify(p));
  })()
`)

console.log(`\n---- ${bad} text run${bad === 1 ? '' : 's'} below its threshold ----`)
ws.close()
chrome.kill()
process.exit(bad === 0 ? 0 : 1)
