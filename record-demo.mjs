// Makes the screen recording of the feature: PNG frames and one GIF.
//
// Every frame is a screenshot taken through the DevTools protocol during this
// one run: Playwright's page.screenshot(), which sends Page.captureScreenshot.
// The only thing added to a screenshot is one caption line under it. The
// untouched screenshots are kept next to the captioned frames, in
// recording-frames/raw/.
//
// The clicks are real: mouse events sent through the DevTools protocol to the
// control's position, on the recorder's own Record and Stop buttons, on the
// page's Place order button, on the Full timeline link and on Download .zip.
// What is not a click is said where it happens, and in recording.md.
//
//   UPSTREAM=<a built checkout of upstream main> node record-demo.mjs
//
// UPSTREAM a checkout of upstream main with `.output/chrome-mv3` built (required)
// REPO     the built checkout with the feature
//          (default: ../../session-recorder-chrome-extension)
// PROFILE  one Chromium profile folder, reused from run to run
//          (default: ../../tools/chromium-profile). Use a folder kept for this
//          demo only: the script deletes the recordings stored in it.
// CHROMIUM the browser to run (default: /usr/bin/chromium)
// Needs ImageMagick (`magick`) and `grep` on PATH. Installs nothing.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './server.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(
  process.env.REPO ?? path.join(here, '..', '..', 'session-recorder-chrome-extension'),
);
if (!process.env.UPSTREAM) throw new Error('Set UPSTREAM to a built checkout of upstream main.');
const upstream = path.resolve(process.env.UPSTREAM);
const profile = path.resolve(
  process.env.PROFILE ?? path.join(here, '..', '..', 'tools', 'chromium-profile'),
);
const require = createRequire(path.join(repo, 'package.json'));
const { chromium } = require('@playwright/test');
const { unzipSync } = require('fflate');

// 960 x 540 CSS pixels at 1.4 device pixels each: frames are 1344 pixels wide.
const VIEWPORT = { width: 960, height: 540 };
const SCALE = 1.4;
const CAPTION_HEIGHT = 64;
const CAPTION_FONT = process.env.CAPTION_FONT ?? 'Liberation-Sans';
const APP = 'http://localhost:5320/';

const startedAt = Date.now();
const framesDir = path.join(here, 'recording-frames');
const rawDir = path.join(framesDir, 'raw');
const runDir = path.join(here, 'recording-run');
for (const dir of [framesDir, runDir]) rmSync(dir, { recursive: true, force: true });
for (const dir of [rawDir, runDir, profile]) mkdirSync(dir, { recursive: true });

/** The frames of the recording, in order. */
const frames = [];

function run(cmd, args, options = {}) {
  const res = spawnSync(cmd, args, { encoding: 'utf8', ...options });
  if (res.error) throw res.error;
  return res;
}

/** A command as a person would type it, for display. */
function typed(cmd, args) {
  return [cmd, ...args.map((a) => (/^[\w./=-]+$/.test(a) ? a : `'${a}'`))].join(' ');
}

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * One pass over the demo with one build of the extension. With `record`, each
 * step is captured as a frame; without it the same steps run and only the
 * last frame is kept.
 */
async function pass({ name, build, record, lastFrame }) {
  const logFile = path.join(runDir, `${name}-server.log`);
  const server = await startServer({ logFile });
  const context = await chromium.launchPersistentContext(profile, {
    executablePath: process.env.CHROMIUM ?? '/usr/bin/chromium',
    headless: true,
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    // The browser's clock reads UTC, like the server's log.
    env: { ...process.env, TZ: 'UTC' },
    args: [
      `--disable-extensions-except=${build}`,
      `--load-extension=${build}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  /** Screenshot `page` through the DevTools protocol and add it as a frame. */
  async function frame(page, slug, seconds, caption, how, always = false) {
    if (!record && !always) return;
    await page.waitForTimeout(400); // let the page settle
    const file = `${String(frames.length + 1).padStart(2, '0')}-${slug}.png`;
    writeFileSync(path.join(rawDir, file), await page.screenshot({ type: 'png' }));
    frames.push({ file, seconds, caption, how });
    console.log(`frame ${file}: ${caption}`);
  }

  try {
    const background =
      context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const extensionId = new URL(background.url()).host;
    // The background's test hook. It is used for the setup below and to check
    // what a click did. No step of the recording is driven through it.
    const hook = (msg) => background.evaluate((m) => globalThis.__srTest(m), msg);

    // Setup, through the hook, not shown: the profile is reused, so the
    // recorder still lists the sessions of earlier runs. Remove them.
    const { sessions } = await hook({ kind: 'session/list' });
    for (const s of sessions) await hook({ kind: 'session/delete', sessionId: s.id });

    // 1) The app under test.
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(APP);
    const placeOrder = page.getByRole('button', { name: 'Place order' });
    await placeOrder.waitFor();
    await frame(
      page,
      'checkout',
      2.5,
      '1. A checkout page on a local server, in Chromium with the built extension loaded.',
      'Navigation to the page. No click.',
    );

    // 2) The recorder. Headless Chromium has no toolbar and no side panel, so
    // the panel's own page is opened in a second tab. The checkout tab is
    // brought back to the front, as it is when the panel sits beside it:
    // Record records the active tab of its window.
    const panel = await context.newPage();
    await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    const recordButton = panel.getByRole('button', { name: 'Start recording', exact: true });
    await recordButton.waitFor();
    await frame(
      panel,
      'recorder',
      2,
      '2. The recorder, opened as a tab: headless Chromium has no side panel. Next: click Record.',
      "Navigation to the panel's page in a second tab. The checkout tab is then made the active tab again. No click.",
    );
    await page.bringToFront();
    await recordButton.click(); // real click on the recorder's own Record control
    const stopButton = panel.getByRole('button', { name: 'Stop', exact: true });
    await stopButton.waitFor();
    const state = await hook({ kind: 'session/getState' });
    const tab = state.session?.tabs?.[0];
    if (!state.recording || !tab?.url?.startsWith(APP)) {
      throw new Error(`Record did not start a recording of the checkout tab: ${state.error}`);
    }
    if (!state.attachedTabIds.includes(tab.tabId)) {
      throw new Error(`The debugger did not attach, so no request is captured: ${state.error}`);
    }
    await page.waitForTimeout(800); // let the content scripts activate
    await frame(
      panel,
      'recording',
      2,
      '2. A real click on Record. The recorder is now recording the checkout tab.',
      "Real click on the recorder's own Record button.",
    );

    // 3) What the reporter does.
    await placeOrder.click(); // real click on the page
    await page.getByText('Order failed (503).').waitFor();
    await frame(
      page,
      'order-failed',
      2.5,
      '3. A real click on Place order. The page shows "Order failed (503)."',
      "Real click on the page's Place order button.",
    );
    await panel.getByText('POST /api/orders').waitFor();
    await frame(
      panel,
      'recorder-saw-it',
      2.5,
      '3. The recorder saw the click and the failed request. Next: click Stop.',
      'No click. The same recorder tab, a moment later.',
    );

    // 4) Stop. The recorder then opens its report in a new tab.
    const reportTab = context.waitForEvent('page');
    await stopButton.click(); // real click on the recorder's own Stop control
    const report = await reportTab;
    const fullTimeline = report.getByRole('link', { name: 'Full timeline' });
    await fullTimeline.waitFor();
    await recordButton.waitFor();
    await panel.locator('.session-row__name').first().waitFor();
    await frame(
      panel,
      'stopped',
      2,
      '4. A real click on Stop. The recording is saved.',
      "Real click on the recorder's own Stop button.",
    );

    // 5) The report tab, then the Full timeline.
    await frame(
      report,
      'report-tab',
      2,
      '5. The report tab the recorder opens after Stop. Next: click Full timeline.',
      'No click. The recorder opened this tab by itself when it stopped.',
    );
    const timelineTab = context.waitForEvent('page');
    await fullTimeline.click(); // real click on the link
    const timeline = await timelineTab;
    const download = timeline.getByRole('button', { name: /Download .zip/i });
    await download.waitFor();
    const failed = timeline.locator('.r-net.r-err').first();
    await failed.waitFor();
    await failed.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await frame(
      timeline,
      'full-timeline',
      4,
      '5. Full timeline (real click): the failed request. Its IDs are in report.md, not on this page.',
      'Real click on the Full timeline link. The page is then scrolled to the failed request by script.',
    );

    // 6) Download .zip: a real download, saved and unpacked.
    const downloading = timeline.waitForEvent('download');
    await download.click(); // real click on the report page's Download button
    const zipPath = path.join(runDir, `${name}.zip`);
    await (await downloading).saveAs(zipPath);
    for (const [entry, bytes] of Object.entries(unzipSync(readFileSync(zipPath)))) {
      const target = path.join(runDir, name, entry.split('/').slice(1).join('/'));
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, bytes);
    }

    // The last frame of the pass: the output of grep on the files of this run,
    // printed in a page so that it can be captured like every other frame.
    const { note, commands, seconds, caption, how } = lastFrame({
      report: readFileSync(path.join(runDir, name, 'report.md'), 'utf8'),
      log: readFileSync(logFile, 'utf8'),
    });
    const blocks = commands.map(([cmd, ...args]) => {
      const out = run(cmd, args, { cwd: runDir }).stdout.replace(/\n+$/, '');
      return `<span class="cmd">$ ${escapeHtml(typed(cmd, args))}</span>\n${escapeHtml(out)}`;
    });
    const terminal = await context.newPage();
    await terminal.setContent(`<!doctype html><meta charset="utf-8"><style>
      body { margin: 0; background: #0f1115; color: #e8eaed; }
      p { margin: 0; padding: 14px 24px 0; color: #9aa3b2; font: 13px/1.4 "Liberation Sans", sans-serif; }
      pre { margin: 0; padding: 12px 24px; white-space: pre-wrap; overflow-wrap: anywhere;
            font: 14.5px/1.6 "Liberation Mono", monospace; }
      .cmd { color: #7ee787; }
    </style><p>${escapeHtml(note)}</p><pre>${blocks.join('\n\n')}</pre>`);
    await frame(terminal, `report-md-${name}`, seconds, caption, how, true);
  } finally {
    await context.close();
    server.close();
  }
}

// The build with the feature: every step is a frame.
await pass({
  name: 'feature',
  build: path.join(repo, '.output', 'chrome-mv3'),
  record: true,
  lastFrame({ report, log }) {
    const id = /`x-request-id: ([0-9a-f-]{36})`/.exec(report)?.[1];
    if (!id) throw new Error('report.md does not list the x-request-id of the failed request.');
    if (!log.includes(`request_id=${id} `)) {
      throw new Error(`The server's log has no line for ${id}, the ID printed in report.md.`);
    }
    return {
      note: 'Output of grep, printed in a page. report.md is from the ZIP just downloaded; the log is what the demo server wrote.',
      commands: [
        ['grep', '-A2', '503 POST /api/orders', 'feature/report.md'],
        ['grep', id, 'feature-server.log'],
      ],
      seconds: 5,
      caption:
        "6. A real click on Download .zip. report.md lists the IDs; the ID finds the server's log line.",
      how: 'Real click on Download .zip; a real download. The frame is a page that prints the output of two grep commands run on the downloaded report.md and on the server log.',
    };
  },
});

// A build of upstream main: the same steps, and only the last frame is kept.
await pass({
  name: 'upstream',
  build: path.join(upstream, '.output', 'chrome-mv3'),
  record: false,
  lastFrame({ report, log }) {
    const id = /request_id=([0-9a-f-]{36}) .*POST \/api\/orders 503/.exec(log)?.[1];
    if (!id) throw new Error('The server did not log the failed request.');
    if (report.includes(id) || report.includes('correlation IDs')) {
      throw new Error('The upstream build printed an ID. Is UPSTREAM a build of upstream main?');
    }
    return {
      note: 'Output of grep, printed in a page. The same steps and the same real clicks, with a build of upstream main.',
      commands: [
        ['grep', '-A2', '503 POST /api/orders', 'upstream/report.md'],
        ['grep', '-o', 'request_id=[0-9a-f-]*', 'upstream-server.log'],
        ['grep', '-c', id, 'upstream/report.md', 'upstream/session.json'],
      ],
      seconds: 4.5,
      caption:
        '7. The same steps with a build of upstream main: report.md has no ID for the failed request.',
      how: 'The same steps and real clicks as 1 to 6, with a build of upstream main; none of them is shown. The frame prints grep output from that second export.',
    };
  },
});

// Captions: one line under each screenshot. Then the GIF.
const width = Math.round(VIEWPORT.width * SCALE);
const height = Math.round(VIEWPORT.height * SCALE);
for (const f of frames) {
  const size = run('magick', ['identify', '-format', '%wx%h', path.join(rawDir, f.file)]).stdout;
  if (size !== `${width}x${height}`) throw new Error(`${f.file} is ${size}, not ${width}x${height}.`);
  const text = run('magick', [
    '-font', CAPTION_FONT, '-pointsize', '29', `label:${f.caption}`, '-format', '%w', 'info:',
  ]);
  if (Number(text.stdout) > width - 56) throw new Error(`Caption too long: ${f.caption}`);
  const res = run('magick', [
    path.join(rawDir, f.file),
    '-background', '#16181d', '-gravity', 'south', '-splice', `0x${CAPTION_HEIGHT}`,
    '-font', CAPTION_FONT, '-pointsize', '29', '-fill', '#ffffff',
    '-gravity', 'southwest', '-annotate', '+28+16', f.caption,
    path.join(framesDir, f.file),
  ]);
  if (res.status !== 0) throw new Error(`magick failed: ${res.stderr}`);
}
const gif = path.join(here, 'recording.gif');
const res = run('magick', [
  '-loop', '0', '+dither', // flat colours stay flat
  ...frames.flatMap((f) => ['-delay', String(Math.round(f.seconds * 100)), path.join(framesDir, f.file)]),
  '-layers', 'Optimize',
  gif,
]);
if (res.status !== 0) throw new Error(`magick failed: ${res.stderr}`);

const seconds = frames.reduce((sum, f) => sum + f.seconds, 0);
const bytes = statSync(gif).size;
writeFileSync(
  path.join(framesDir, 'frames.json'),
  `${JSON.stringify({ width, height: height + CAPTION_HEIGHT, seconds, bytes, frames }, null, 2)}\n`,
);
console.log(
  `\nrecording.gif: ${frames.length} frames, ${width} x ${height + CAPTION_HEIGHT} pixels, ${seconds} s, ${bytes} bytes`,
);
console.log(`made in ${Math.round((Date.now() - startedAt) / 1000)} s`);
if (width < 1200 || width > 1400) throw new Error('The GIF must be 1200 to 1400 pixels wide.');
if (seconds > 30) throw new Error('The GIF must be at most 30 seconds.');
if (bytes > 4 * 1024 * 1024) throw new Error('The GIF must be at most 4 MB.');
