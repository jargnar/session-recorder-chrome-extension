# Demonstration: a failed request lists its request and trace IDs

For the pull request "List the request and trace IDs of a failed request in the report" on
prooflinedev/session-recorder-chrome-extension.

- `recording.gif`: the recording. 10 frames, 1344 × 820 pixels, 29 seconds.
- `record-demo.mjs`: the script that made it. `server.mjs`: the demo server it starts.
- `report.md`: the report from the ZIP that the click on Download .zip downloaded in that run.
- `server.log`: what the demo server logged in that run.
- `report-on-main.md`: the report of the same steps with a build of upstream `main` (016cc4a).

One run made every frame: Chromium 153, headless, with the built extension, on loopback only.

## What each frame did

| Frame | Held | Caption under the frame | What was done |
| --- | --- | --- | --- |
| 1 | 2.5 s | 1. A checkout page on a local server, in Chromium with the built extension loaded. | Navigation to the page. No click. |
| 2 | 2 s | 2. The recorder, opened as a tab: headless Chromium has no side panel. Next: click Record. | Navigation to the panel's page in a second tab. The checkout tab is then made the active tab again. No click. |
| 3 | 2 s | 2. A real click on Record. The recorder is now recording the checkout tab. | Real click on the recorder's own Record button. |
| 4 | 2.5 s | 3. A real click on Place order. The page shows "Order failed (503)." | Real click on the page's Place order button. |
| 5 | 2.5 s | 3. The recorder saw the click and the failed request. Next: click Stop. | No click. The same recorder tab, a moment later. |
| 6 | 2 s | 4. A real click on Stop. The recording is saved. | Real click on the recorder's own Stop button. |
| 7 | 2 s | 5. The report tab the recorder opens after Stop. Next: click Full timeline. | No click. The recorder opened this tab by itself when it stopped. |
| 8 | 4 s | 5. Full timeline (real click): the failed request. Its IDs are in report.md, not on this page. | Real click on the Full timeline link. The page is then scrolled to the failed request by script. |
| 9 | 5 s | 6. A real click on Download .zip. report.md lists the IDs; the ID finds the server's log line. | Real click on Download .zip; a real download. The frame is a page that prints the output of two grep commands run on the downloaded report.md and on the server log. |
| 10 | 4.5 s | 7. The same steps with a build of upstream main: report.md has no ID for the failed request. | The same steps and real clicks as 1 to 6, with a build of upstream main; none of them is shown. The frame prints grep output from that second export. |

## Real, and not real

- **Five real clicks, no test hook.** Record, Place order, Stop, Full timeline and Download .zip. Each is a mouse
  press and release sent through the DevTools protocol at the control's position (Playwright's `click()`), which
  the browser handles as input from the user.
- **Opening the recorder is not a click.** Headless Chromium has no toolbar and no side panel. The script opens the
  panel's own page, `sidepanel.html`, in a second tab of the same window. Before the click on Record it makes the
  checkout tab the active tab again. Record records the active tab of its window, so this is the arrangement of a
  panel beside the page. After the click the script checks that the recording is of the checkout tab and that the
  debugger attached to it.
- **The test hook is used twice, and neither use is shown.** Before the first frame it deletes the recordings that
  earlier runs left in the reused profile. After the click on Record it reads the recorder's state, for the check
  above.
- **The download is real.** The click on Download .zip starts a browser download. The script saves that file and
  unpacks it.
- **The last two frames are not screens of the product.** Each is a page that prints the output of `grep` on the
  files of this run, so that it could be captured like the other frames. The first line of the page says so.
- **The last frame comes from a second pass in the same run,** with the same five real clicks and a build of
  upstream `main`. Only its last frame is kept.
- **The Full timeline inside the extension does not show the IDs.** This change prints them in `report.md`, and so
  in the hosted report, and leaves the Full timeline as it is.
- **Every frame is a screenshot through the DevTools protocol** (`Page.captureScreenshot`), with one caption strip
  added underneath by ImageMagick. The Full timeline is scrolled to the failed request by script. The browser ran
  with `TZ=UTC`.

## Make it again

With a built checkout of the pull request branch, a built checkout of `main`, and an empty folder for the browser
profile (the script deletes the recordings stored in it):

```sh
REPO=path/to/branch UPSTREAM=path/to/main PROFILE=path/to/empty-folder node record-demo.mjs
```

It needs ImageMagick (`magick`) and `grep`, and takes about 40 seconds. `CHROMIUM` names the browser (default
`/usr/bin/chromium`). Every run makes new request IDs, so the text in the last two frames differs each time.
