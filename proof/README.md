# Screenshot

The image is from the extension built at 0010fd4, which already contains `main` (c1727d3). It was captured headless in Chromium 153 at a 1280×720 viewport by the named spec, on `demo/index.html`. Fetch routes in that spec answer the page's two requests; nothing left the machine.

It shows `report.md` itself: the file from the zip that the Full timeline's Download .zip button made in that run, opened as plain text in the same browser and captured from the top of the file. The export writes no `report.html` (the side panel's "Also include a rendered HTML page" option is not mounted since #8), and the Full timeline page does not show headers, so it has no ID lines to capture.

| File | Behavior | Spec and fixture |
| --- | --- | --- |
| `report-md-failed-request-ids` | `report.md` of a recording at Standard (L1): `503 POST /api/orders` lists its `x-request-id`, which came with the response, and its `traceparent`, which the page sent. `200 GET /api/cart` carried both too and lists neither. | `e2e/correlation-ids.spec.ts`, "in recorded traffic, only the failed request lists its IDs in report.md"; `page.route` fixtures answer `GET /api/cart` with 200 and `POST /api/orders` with 503, each with an `x-request-id` |

To make it again at 0010fd4: `pnpm build`, then `E2E_PROOF_DIR=<folder> pnpm exec playwright test e2e/correlation-ids.spec.ts -g "recorded traffic"`. Without `E2E_PROOF_DIR` the test writes no file.
