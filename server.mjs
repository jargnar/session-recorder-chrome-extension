// A checkout page whose order request fails on the server. Loopback only.
//
// The server names every request with an `x-request-id` response header and
// writes the same ID to its log, the way most back ends do. The page sends a
// `traceparent` request header, the way a page instrumented with OpenTelemetry
// does. Run it by itself with:  node server.mjs
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PAGE = `<!doctype html>
<meta charset="utf-8" />
<title>Checkout demo</title>
<body style="font: 16px/1.5 system-ui; margin: 40px; max-width: 520px">
  <h1>Checkout</h1>
  <p>Weekender pack, 1 × $120.00</p>
  <button id="refresh">Refresh cart</button>
  <button id="order">Place order</button>
  <p id="status" role="status"></p>
  <script>
    const status = document.getElementById('status');
    // What an instrumented page sends: a W3C trace context for this request.
    const hex = (n) => [...crypto.getRandomValues(new Uint8Array(n))]
      .map((b) => b.toString(16).padStart(2, '0')).join('');
    const traceparent = () => '00-' + hex(16) + '-' + hex(8) + '-01';
    document.getElementById('refresh').onclick = async () => {
      const res = await fetch('/api/cart', { headers: { traceparent: traceparent() } });
      status.textContent = 'Cart loaded (' + res.status + ').';
    };
    document.getElementById('order').onclick = async () => {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json', traceparent: traceparent() },
        body: JSON.stringify({ cart: 'c1', total: 120 }),
      });
      status.textContent = res.ok ? 'Order placed.' : 'Order failed (' + res.status + ').';
    };
  </script>
</body>`;

/** Start the demo server. Each handled API request is logged with its ID. */
export function startServer({ port = 5320, logFile } = {}) {
  const log = (line) => {
    const text = `${new Date().toISOString()} ${line}`;
    console.log(text);
    if (logFile) appendFileSync(logFile, `${text}\n`);
  };
  const server = createServer((req, res) => {
    const requestId = randomUUID();
    const traceId = String(req.headers.traceparent ?? '').split('-')[1] ?? '-';
    if (req.method === 'POST' && req.url === '/api/orders') {
      log(
        `ERROR request_id=${requestId} trace_id=${traceId} POST /api/orders 503 ` +
          `payment provider timed out after 3000 ms (pool "payments" exhausted)`,
      );
      res.writeHead(503, { 'content-type': 'application/json', 'x-request-id': requestId });
      res.end('{"error":"payment_unavailable"}');
    } else if (req.url === '/api/cart') {
      log(`INFO  request_id=${requestId} trace_id=${traceId} GET /api/cart 200`);
      res.writeHead(200, { 'content-type': 'application/json', 'x-request-id': requestId });
      res.end('{"items":[{"sku":"weekender","qty":1,"price":120}]}');
    } else if (req.url === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(PAGE);
    } else {
      res.writeHead(204);
      res.end();
    }
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await startServer({ logFile: process.env.DEMO_LOG });
  console.log('Checkout demo on http://localhost:5320');
}
